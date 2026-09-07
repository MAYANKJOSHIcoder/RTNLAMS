/**
 * Spatial Query API — Client-side Supabase + PostGIS helpers
 * PROMPT 11 — src/lib/supabase/queries.ts
 * All queries use Supabase PostGIS (ST_Within, ST_Intersects, ST_DWithin) via RPC when available,
 * with graceful client-side fallback when running in mock/deferred-keys mode.
 * Returns typed results matching src/lib/types.
 */
import { supabase, isSupabaseConfigured } from './client';
import type { Parcel, BBox, GeoJsonGeometry, ParcelStatus } from '../types';

// Helper: sanitize bbox inputs
function sanitizeBbox(bbox: BBox): BBox {
  const [a, b, c, d] = bbox.map((n) => Number(n));
  if ([a, b, c, d].some((n) => Number.isNaN(n))) throw new Error('Invalid bbox numbers');
  return [a, b, c, d];
}

// Helper: haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

function centroidOf(parcel: Parcel): { lat: number; lng: number } | null {
  if (!parcel.geometry || parcel.geometry.type !== 'Polygon') return null;
  const coords = (parcel.geometry.coordinates as number[][][])[0];
  if (!coords?.length) return null;
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return {
    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
  };
}

// ---------------------------------------------------------------------------
// 1. getParcelsByBbox
// ---------------------------------------------------------------------------
export async function getParcelsByBbox(bbox: BBox): Promise<Parcel[]> {
  try {
    sanitizeBbox(bbox);
    if (!isSupabaseConfigured()) {
      // Fallback uses in-memory mock via useParcels logic — return empty until configured
      return [];
    }
    // Try PostGIS RPC if exists (ST_Within). If RPC not defined, fallback to full fetch + client filter
    const [minLng, minLat, maxLng, maxLat] = bbox;
    // Attempt RPC: parcels_within_bbox
    const rpc = await supabase.rpc('parcels_within_bbox' as never, { min_lng: minLng, min_lat: minLat, max_lng: maxLng, max_lat: maxLat } as never);
    if (!rpc.error && Array.isArray(rpc.data)) return rpc.data as Parcel[];
    // Fallback: fetch all then filter
    const { data, error } = await supabase.from('parcels').select('*');
    if (error) throw new Error(error.message);
    const parcels = (data ?? []) as Parcel[];
    return parcels.filter((p) => {
      const c = centroidOf(p);
      if (!c) return true;
      return c.lng >= minLng && c.lng <= maxLng && c.lat >= minLat && c.lat <= maxLat;
    });
  } catch (e) {
    console.warn('[queries:getParcelsByBbox]', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. getParcelsByProject
// ---------------------------------------------------------------------------
export async function getParcelsByProject(projectId: string): Promise<Parcel[]> {
  try {
    const pid = String(projectId ?? '').trim();
    if (!pid) throw new Error('projectId required');
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase.from('parcels').select('*').eq('project_id', pid);
    if (error) throw new Error(error.message);
    return (data ?? []) as Parcel[];
  } catch (e) {
    console.warn('[queries:getParcelsByProject]', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 3. getParcelById
// ---------------------------------------------------------------------------
export async function getParcelById(id: string): Promise<Parcel | null> {
  try {
    const pid = String(id ?? '').trim();
    if (!pid) throw new Error('parcel id required');
    if (!isSupabaseConfigured()) return null;
    const { data, error } = await supabase.from('parcels').select('*').eq('id', pid).single();
    if (error) throw new Error(error.message);
    return data as Parcel;
  } catch (e) {
    console.warn('[queries:getParcelById]', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. getParcelsNearby
// ---------------------------------------------------------------------------
export async function getParcelsNearby(lat: number, lng: number, radiusMeters: number): Promise<Parcel[]> {
  try {
    const la = Number(lat);
    const ln = Number(lng);
    const r = Number(radiusMeters);
    if ([la, ln, r].some((n) => Number.isNaN(n))) throw new Error('Invalid nearby params');
    if (!isSupabaseConfigured()) return [];
    // Try PostGIS ST_DWithin RPC
    const rpc = await supabase.rpc('parcels_nearby' as never, { lat: la, lng: ln, radius_meters: r } as never);
    if (!rpc.error && Array.isArray(rpc.data)) return rpc.data as Parcel[];
    // Fallback: haversine filter
    const { data, error } = await supabase.from('parcels').select('*');
    if (error) throw new Error(error.message);
    const parcels = (data ?? []) as Parcel[];
    return parcels.filter((p) => {
      const c = centroidOf(p);
      if (!c) return false;
      return haversine(la, ln, c.lat, c.lng) <= r;
    });
  } catch (e) {
    console.warn('[queries:getParcelsNearby]', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 5. getParcelsIntersectingCorridor
// ---------------------------------------------------------------------------
export async function getParcelsIntersectingCorridor(corridorGeometry: GeoJsonGeometry): Promise<Parcel[]> {
  try {
    if (!corridorGeometry) throw new Error('corridorGeometry required');
    if (!isSupabaseConfigured()) return [];
    const rpc = await supabase.rpc('parcels_intersecting_corridor' as never, { corridor: corridorGeometry as never } as never);
    if (rpc.error) throw new Error(rpc.error.message);
    return (rpc.data ?? []) as Parcel[];
  } catch (e) {
    console.warn('[queries:getParcelsIntersectingCorridor]', e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

// ---------------------------------------------------------------------------
// 6. getParcelsByStatus
// ---------------------------------------------------------------------------
export async function getParcelsByStatus(projectId: string, status: ParcelStatus): Promise<Parcel[]> {
  try {
    const pid = String(projectId ?? '').trim();
    const st = String(status ?? '').trim() as ParcelStatus;
    if (!pid || !st) throw new Error('projectId and status required');
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase.from('parcels').select('*').eq('project_id', pid).eq('status', st);
    if (error) throw new Error(error.message);
    return (data ?? []) as Parcel[];
  } catch (e) {
    console.warn('[queries:getParcelsByStatus]', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 7. getParcelStats
// ---------------------------------------------------------------------------
export interface ParcelStats {
  total: number;
  totalAreaHectares: number;
  byStatus: Record<ParcelStatus, number>;
  highRisk: number;
  disputed: number;
}

export async function getParcelStats(projectId: string): Promise<ParcelStats | null> {
  try {
    const pid = String(projectId ?? '').trim();
    if (!pid) throw new Error('projectId required');
    if (!isSupabaseConfigured()) return null;
    const { data, error } = await supabase.from('parcels').select('status, area_hectares, risk_score').eq('project_id', pid);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Pick<Parcel, 'status' | 'area_hectares' | 'risk_score'>[];
    const byStatus = { identified: 0, notified: 0, surveyed: 0, acquired: 0, disputed: 0 } as Record<ParcelStatus, number>;
    let totalArea = 0;
    let highRisk = 0;
    rows.forEach((r) => {
      const s = r.status as ParcelStatus;
      if (s in byStatus) byStatus[s]++;
      totalArea += Number(r.area_hectares ?? 0);
      if (Number(r.risk_score ?? 0) > 0.6) highRisk++;
    });
    return {
      total: rows.length,
      totalAreaHectares: Number(totalArea.toFixed(2)),
      byStatus,
      highRisk,
      disputed: byStatus.disputed,
    };
  } catch (e) {
    console.warn('[queries:getParcelStats]', e);
    return null;
  }
}
