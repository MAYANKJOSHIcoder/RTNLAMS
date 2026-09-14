import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { Parcel, FeatureCollection, MapFeature, GeoJsonGeometry } from '../lib/types';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  identified: '#93C5FD',
  notified: '#FDE68A',
  surveyed: '#6EE7B7',
  acquired: '#86EFAC',
  disputed: '#FCA5A5',
};

function closeRing(coords: [number, number][]): [number, number][] {
  if (!coords || coords.length === 0) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...coords, [first[0], first[1]]];
  }
  return coords;
}

// Strip non-standard fields (e.g. PostGIS `crs`) that violate RFC 7946.
// MapLibre silently drops features whose geometry contains unknown keys.
function stripCrs(g: Record<string, unknown>): Record<string, unknown> {
  if (!g || typeof g !== 'object') return g;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { crs, ...clean } = g;
  return clean;
}

function toRenderableGeometry(raw: GeoJsonGeometry): GeoJsonGeometry | null {
  if (!raw || !raw.type) return null;
  // Strip PostGIS `crs` field that breaks MapLibre
  const g = stripCrs(raw as unknown as Record<string, unknown>) as unknown as GeoJsonGeometry;
  if (g.type === 'Point') {
    const [lng, lat] = g.coordinates;
    const d = 0.004;
    const ring: [number, number][] = [
      [lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d],
    ];
    return { type: 'Polygon', coordinates: [ring] };
  }
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: g.coordinates.map(closeRing) };
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map(poly => poly.map(closeRing)) };
  return g;
}

function geometryFromParcel(parcel: Parcel): GeoJsonGeometry | null {
  if (parcel.geometry) {
    return toRenderableGeometry(parcel.geometry as GeoJsonGeometry) || (parcel.geometry as GeoJsonGeometry);
  }

  if (parcel.latitude != null && parcel.longitude != null) {
    const lat = Number(parcel.latitude);
    const lng = Number(parcel.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }

  return null;
}

function parcelToFeature(parcel: Parcel): MapFeature | null {
  const geometry = geometryFromParcel(parcel);
  if (!geometry) return null;
  return {
    type: 'Feature',
    geometry,
    properties: {
      id: parcel.id,
      parcel_number: parcel.parcel_number,
      status: parcel.status,
      risk_level: parcel.risk_score != null ? (parcel.risk_score > 0.8 ? 'critical' : parcel.risk_score > 0.6 ? 'high' : parcel.risk_score > 0.3 ? 'medium' : 'low') : undefined,
      owner_name: parcel.owner_name,
      area_hectares: parcel.area_hectares,
      project_id: parcel.project_id,
      latitude: parcel.latitude,
      longitude: parcel.longitude,
    },
    id: parcel.id,
  };
}

export function parcelsToFeatureCollection(parcels: Parcel[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: parcels.map(parcelToFeature).filter(Boolean) as MapFeature[],
  };
}

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#CBD5E1';
}

// Fetch parcels within bbox (or all if no bbox) — uses Supabase + PostGIS bbox via ST_Within if configured; falls back to full fetch
// Waits for auth session to be restored before querying so RLS doesn't block reads.
export function useParcels(bbox?: [number, number, number, number] | null, projectId?: string, enabled = true) {
  const { user, loading: authLoading } = useAuth();
  return useQuery({
    // Include user id in cache key so the cache is invalidated on login/logout
    queryKey: ['parcels', bbox, projectId, user?.id ?? null],
    // Don't fire the query while auth is still restoring the session
    enabled: enabled && !authLoading && !!user,
    queryFn: async () => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      let query = supabase.from('parcels').select('*');
      if (projectId) query = query.eq('project_id', projectId);
      // BBox filtering via PostGIS — if bbox provided, filter by intersecting geometry (client-side fallback if RPC unavailable)
      // Supabase PostGIS: use .rpc or raw filter; here try .within bbox via string
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      let parcels = (data ?? []) as Parcel[];
      if (bbox) {
        const [minLng, minLat, maxLng, maxLat] = bbox;
        parcels = parcels.filter((p) => {
          if (!p.geometry || p.geometry.type !== 'Polygon') return true;
          // centroid-in-bbox check (cheap; PostGIS RPC used in queries.ts when available)
          const coords = (p.geometry.coordinates as number[][][])[0];
          const lngs = coords.map((c) => c[0]);
          const lats = coords.map((c) => c[1]);
          const clng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
          const clat = lats.reduce((a, b) => a + b, 0) / lats.length;
          return clng >= minLng && clng <= maxLng && clat >= minLat && clat <= maxLat;
        });
      }
      return parcels;
    },
    staleTime: 30_000,
  });
}

export function useParcelsGeoJson(bbox?: [number, number, number, number] | null, projectId?: string) {
  const q = useParcels(bbox, projectId);
  const geoJson = useMemo(
    () => (q.data ? parcelsToFeatureCollection(q.data) : ({ type: 'FeatureCollection', features: [] } as FeatureCollection)),
    [q.data],
  );
  return {
    ...q,
    geoJson,
  };
}

export function useCreateParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parcel: Partial<Parcel>) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      // sanitize before insert — 12 stage rows are created by the DB trigger
      const sanitized = {
        parcel_number: String(parcel.parcel_number ?? '').trim(),
        owner_name: String(parcel.owner_name ?? '').trim(),
        owner_aadhaar: parcel.owner_aadhaar ? String(parcel.owner_aadhaar).trim() : null,
        area_hectares: Number(parcel.area_hectares ?? 0),
        project_id: parcel.project_id,
        land_use: parcel.land_use ?? null,
        village: parcel.village ?? null,
        district: parcel.district ?? null,
        state: parcel.state ?? null,
        survey_number: parcel.survey_number ?? null,
        latitude: parcel.latitude ?? null,
        longitude: parcel.longitude ?? null,
        geometry: parcel.geometry,
      };
      const { data, error } = await supabase.from('parcels').insert(sanitized).select().single();
      if (error) throw new Error(error.message);
      return data as Parcel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parcels'] });
      qc.invalidateQueries({ queryKey: ['stage-counts'] });
      qc.invalidateQueries({ queryKey: ['stages'] });
      toast.success('Parcel created — 12-stage lifecycle initialized');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Parcel> & { id: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const { data, error } = await supabase.from('parcels').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as Parcel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parcels'] });
      toast.success('Parcel updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const { error } = await supabase.from('parcels').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parcels'] });
      toast.success('Parcel deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
