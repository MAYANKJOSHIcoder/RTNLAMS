import { describe, it, expect, vi } from 'vitest';

// Parcel fixtures: square polygons ~1km wide
function makeParcel(id: string, lng: number, lat: number) {
  const d = 0.005;
  return {
    id,
    parcel_number: id,
    owner_name: 'Owner',
    project_id: 'proj',
    area_hectares: 1,
    status: 'identified',
    risk_score: 0.2,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng, lat],
          [lng + d, lat],
          [lng + d, lat + d],
          [lng, lat + d],
          [lng, lat],
        ],
      ],
    },
  };
}

vi.mock('./client', () => {
  const parcels = [makeParcel('near', 77.1, 28.4), makeParcel('far', 72.8, 19.0)];
  return {
    isSupabaseConfigured: () => true,
    supabase: {
      // RPC always fails → exercises client-side fallbacks
      rpc: vi.fn(async () => ({ data: null, error: { message: 'function does not exist' } })),
      from: vi.fn(() => ({
        select: vi.fn(async () => ({ data: parcels, error: null })),
      })),
    },
  };
});

import { getParcelsByBbox, getParcelsNearby, getParcelsIntersectingCorridor } from './queries';

describe('getParcelsByBbox', () => {
  it('returns parcels whose centroid falls inside the bbox', async () => {
    const result = await getParcelsByBbox([77.0, 28.3, 77.2, 28.5]);
    expect(result.map((p) => p.id)).toEqual(['near']);
  });

  it('returns [] for invalid bbox instead of throwing', async () => {
    const result = await getParcelsByBbox([Number.NaN, 0, 1, 1]);
    expect(result).toEqual([]);
  });
});

describe('getParcelsNearby', () => {
  it('filters by haversine distance when RPC missing', async () => {
    const close = await getParcelsNearby(28.4, 77.1, 10_000);
    expect(close.map((p) => p.id)).toEqual(['near']);
    const wide = await getParcelsNearby(28.4, 77.1, 5_000_000);
    expect(wide).toHaveLength(2);
  });
});

describe('getParcelsIntersectingCorridor', () => {
  it('falls back to full fetch when corridor RPC missing', async () => {
    const result = await getParcelsIntersectingCorridor({
      type: 'LineString',
      coordinates: [
        [77.0, 28.3],
        [77.2, 28.5],
      ],
    } as never);
    expect(result).toHaveLength(2);
  });
});
