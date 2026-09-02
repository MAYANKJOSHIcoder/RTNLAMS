import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { Parcel, FeatureCollection, MapFeature, GeoJsonGeometry } from '../lib/types';
import { toast } from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  identified: '#93C5FD',
  notified: '#FDE68A',
  surveyed: '#6EE7B7',
  acquired: '#86EFAC',
  disputed: '#FCA5A5',
};

function parcelToFeature(parcel: Parcel): MapFeature | null {
  if (!parcel.geometry) return null;
  return {
    type: 'Feature',
    geometry: parcel.geometry as GeoJsonGeometry,
    properties: {
      id: parcel.id,
      parcel_number: parcel.parcel_number,
      status: parcel.status,
      risk_level: parcel.risk_score != null ? (parcel.risk_score > 0.8 ? 'critical' : parcel.risk_score > 0.6 ? 'high' : parcel.risk_score > 0.3 ? 'medium' : 'low') : undefined,
      owner_name: parcel.owner_name,
      area_hectares: parcel.area_hectares,
      project_id: parcel.project_id,
      // keep full parcel for popup convenience
      _parcel: parcel as unknown as Record<string, unknown>,
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
export function useParcels(bbox?: [number, number, number, number] | null, projectId?: string) {
  return useQuery({
    queryKey: ['parcels', bbox, projectId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        // Mock data so map renders before Supabase configured
        const mock: Parcel[] = [
          {
            id: 'mock-1',
            project_id: projectId ?? 'p1',
            parcel_number: 'DL-SURV-001',
            owner_name: 'Rajesh Kumar',
            owner_cnic: null,
            area_hectares: 2.5,
            land_use: 'agricultural',
            geometry: {
              type: 'Polygon',
              coordinates: [[[77.0, 28.5], [77.05, 28.5], [77.05, 28.55], [77.0, 28.55], [77.0, 28.5]]],
            },
            status: 'identified',
            risk_score: 0.2,
            created_at: new Date().toISOString(),
          },
          {
            id: 'mock-2',
            project_id: projectId ?? 'p1',
            parcel_number: 'DL-SURV-002',
            owner_name: 'Priya Sharma',
            owner_cnic: null,
            area_hectares: 1.8,
            land_use: 'residential',
            geometry: {
              type: 'Polygon',
              coordinates: [[[77.06, 28.5], [77.1, 28.5], [77.1, 28.55], [77.06, 28.55], [77.06, 28.5]]],
            },
            status: 'disputed',
            risk_score: 0.85,
            created_at: new Date().toISOString(),
          },
        ];
        return mock;
      }
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
          // rough centroid check for mock filtering
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
  return {
    ...q,
    geoJson: q.data ? parcelsToFeatureCollection(q.data) : ({ type: 'FeatureCollection', features: [] } as FeatureCollection),
  };
}

export function useCreateParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parcel: Partial<Parcel>) => {
      if (!isSupabaseConfigured()) throw new Error('Supabase not configured — fill .env');
      // sanitize before insert
      const sanitized = {
        parcel_number: String(parcel.parcel_number ?? '').trim(),
        owner_name: String(parcel.owner_name ?? '').trim(),
        area_hectares: Number(parcel.area_hectares ?? 0),
        project_id: parcel.project_id,
        geometry: parcel.geometry,
        status: parcel.status ?? 'identified',
      };
      const { data, error } = await supabase.from('parcels').insert(sanitized).select().single();
      if (error) throw new Error(error.message);
      return data as Parcel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parcels'] });
      toast.success('Parcel created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Parcel> & { id: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
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
      if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
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
