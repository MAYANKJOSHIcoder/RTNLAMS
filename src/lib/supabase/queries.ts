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

// Geodesic helper: shortest distance in meters from point (px, py) to segment (x1, y1)-(x2, y2)
// Coordinates in [lng, lat]
function distancePointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const midLat = ((py + y1 + y2) / 3 * Math.PI) / 180;
  const kx = 111320 * Math.cos(midLat);
  const ky = 110540;

  const dx = (x2 - x1) * kx;
  const dy = (y2 - y1) * ky;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq === 0) {
    return haversine(py, px, y1, x1);
  }

  const ptx = (px - x1) * kx;
  const pty = (py - y1) * ky;
  const t = Math.max(0, Math.min(1, (ptx * dx + pty * dy) / segLenSq));
  const projX = x1 + (t * (x2 - x1));
  const projY = y1 + (t * (y2 - y1));
  return haversine(py, px, projY, projX);
}

// 2D line segment intersection in [lng, lat]
function segmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): boolean {
  const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  return (
    ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
    ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
  );
}

// Ray-casting point-in-polygon test
function pointInPolygon(px: number, py: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Extract line segments from a GeoJson geometry (LineString, etc.)
function extractCorridorSegments(geom: GeoJsonGeometry): [number, number, number, number][] {
  const segments: [number, number, number, number][] = [];
  if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
    const coords = geom.coordinates as [number, number][];
    for (let i = 0; i < coords.length - 1; i++) {
      segments.push([coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]]);
    }
  }
  return segments;
}

// Minimum distance in meters from parcel geometry/point to the corridor alignment
function parcelDistanceToCorridor(parcel: Parcel, corridorSegments: [number, number, number, number][]): number {
  if (!corridorSegments.length) return Number.POSITIVE_INFINITY;

  // Case 1: Polygon geometry
  if (parcel.geometry?.type === 'Polygon' && Array.isArray(parcel.geometry.coordinates)) {
    const ring = (parcel.geometry.coordinates as [number, number][][])[0];
    if (ring && ring.length >= 3) {
      // Direct intersection check between parcel edges and corridor segments
      for (const [cx1, cy1, cx2, cy2] of corridorSegments) {
        // Point in polygon check (if corridor node is inside parcel)
        if (pointInPolygon(cx1, cy1, ring) || pointInPolygon(cx2, cy2, ring)) {
          return 0;
        }
        for (let i = 0; i < ring.length - 1; i++) {
          const [rx1, ry1] = ring[i];
          const [rx2, ry2] = ring[i + 1];
          if (segmentsIntersect(cx1, cy1, cx2, cy2, rx1, ry1, rx2, ry2)) {
            return 0;
          }
        }
      }

      // Check distance from all parcel boundary points to corridor segments
      let minDist = Number.POSITIVE_INFINITY;
      for (const [px, py] of ring) {
        for (const [cx1, cy1, cx2, cy2] of corridorSegments) {
          const d = distancePointToSegment(px, py, cx1, cy1, cx2, cy2);
          if (d < minDist) minDist = d;
        }
      }

      // Also test centroid to corridor segments
      const c = centroidOf(parcel);
      if (c) {
        for (const [cx1, cy1, cx2, cy2] of corridorSegments) {
          const d = distancePointToSegment(c.lng, c.lat, cx1, cy1, cx2, cy2);
          if (d < minDist) minDist = d;
        }
      }
      return minDist;
    }
  }

  // Case 2: Lat/Lng point coordinates
  const lat = Number(parcel.latitude);
  const lng = Number(parcel.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    let minDist = Number.POSITIVE_INFINITY;
    for (const [cx1, cy1, cx2, cy2] of corridorSegments) {
      const d = distancePointToSegment(lng, lat, cx1, cy1, cx2, cy2);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  return Number.POSITIVE_INFINITY;
}

// ---------------------------------------------------------------------------
// 1. getParcelsByBbox
// ---------------------------------------------------------------------------
export async function getParcelsByBbox(bbox: BBox): Promise<Parcel[]> {
  try {
    sanitizeBbox(bbox);
    if (!isSupabaseConfigured()) {
      // Not configured → empty result; hooks surface "Database not connected" separately
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
export async function getParcelsIntersectingCorridor(
  corridorGeometry: GeoJsonGeometry,
  widthMeters = 0,
): Promise<Parcel[]> {
  try {
    if (!corridorGeometry) throw new Error('corridorGeometry required');
    const width = Number(widthMeters);
    if (!Number.isFinite(width) || width < 0) throw new Error('Invalid corridor width');
    if (!isSupabaseConfigured()) return [];

    // Tier 1: Try width-aware PostGIS ST_DWithin RPC (004 migration)
    const rpcWidth = await supabase.rpc('parcels_intersecting_corridor' as never, {
      corridor: corridorGeometry as never,
      width_meters: width,
    } as never);
    if (!rpcWidth.error && Array.isArray(rpcWidth.data)) {
      return rpcWidth.data as Parcel[];
    }

    // Tier 2: If DB still has legacy 1-arg RPC and width is 0, try it
    if (width === 0) {
      const rpcLegacy = await supabase.rpc('parcels_intersecting_corridor' as never, {
        corridor: corridorGeometry as never,
      } as never);
      if (!rpcLegacy.error && Array.isArray(rpcLegacy.data)) {
        return rpcLegacy.data as Parcel[];
      }
    }

    // Tier 3: Client-side geodesic fallback
    // If PostgREST schema cache has not reloaded or 004 migration is not yet applied,
    // fetch parcels and calculate geodesic distance / polygon intersection in JavaScript.
    console.info(
      '[queries:getParcelsIntersectingCorridor] PostGIS RPC not found in schema cache; using client-side spatial fallback. Run supabase/004_corridor_width.sql in Supabase SQL editor to enable database-accelerated queries.',
    );
    const { data, error } = await supabase.from('parcels').select('*');
    if (error) throw new Error(error.message);
    const parcels = (data ?? []) as Parcel[];
    const corridorSegments = extractCorridorSegments(corridorGeometry);
    if (!corridorSegments.length) return [];

    return parcels.filter((p) => {
      const dist = parcelDistanceToCorridor(p, corridorSegments);
      return dist <= width;
    });
  } catch (e) {
    console.warn('[queries:getParcelsIntersectingCorridor]', e);
    return [];
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
