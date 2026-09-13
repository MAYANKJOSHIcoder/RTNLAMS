import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import toast from 'react-hot-toast';
import { useParcelsGeoJson, statusColor } from '../../hooks/useParcels';
import { getParcelsIntersectingCorridor } from '../../lib/supabase/queries';
import { config } from '../../lib/config';
import type { Parcel } from '../../lib/types';
import MapControls from './MapControls';

interface ParcelMapProps {
  projectId?: string;
  onParcelSelect?: (parcel: Parcel) => void;
  selectedParcelId?: string | null;
  height?: string;
}

const INDIA_CENTER: [number, number] = [78.9629, 20.5937];
const STATUS_LEGEND: Record<string, string> = {
  identified: '#93C5FD',
  notified: '#FDE68A',
  surveyed: '#6EE7B7',
  acquired: '#86EFAC',
  disputed: '#FCA5A5',
};

// Esri World Imagery — free satellite basemap, no API key required
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// CARTO Positron (light) raster tiles — requires VITE_CARTO_API_KEY in production
const cartoKey = config.cartoApiKey;
const BASE_TILES = cartoKey
  ? ['https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=' + encodeURIComponent(cartoKey)]
  : ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', 'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'];

// Recursively extend a bounds with every [lng,lat] in a GeoJSON geometry.
// Handles Polygon, MultiPolygon, Point, MultiPoint uniformly (no coordinates[0] guessing).
function extendFeatureBounds(bounds: maplibregl.LngLatBounds, geom?: unknown) {
  const walk = (a: unknown) => {
    if (Array.isArray(a) && a.length >= 2 && typeof a[0] === 'number' && typeof a[1] === 'number') {
      bounds.extend([a[0], a[1]] as [number, number]);
    } else if (Array.isArray(a)) {
      a.forEach(walk);
    }
  };
  walk((geom as { coordinates?: unknown } | undefined)?.coordinates);
}

// Centroid dots: a circle at each polygon's center — guaranteed visible
// even when polygon fill/line layers fail to paint for any reason.
function makeDots(features: { geometry?: unknown; properties?: Record<string, unknown>; id?: string | number }[]) {
  return {
    type: 'FeatureCollection' as const,
    features: features
      .map((f) => {
        const bounds = new maplibregl.LngLatBounds();
        extendFeatureBounds(bounds, f.geometry);
        if (bounds.isEmpty()) return null;
        const center = bounds.getCenter();
        return {
          type: 'Feature' as const,
          id: f.id,
          properties: f.properties ?? {},
          geometry: {
            type: 'Point' as const,
            coordinates: [center.lng, center.lat] as [number, number],
          },
        };
      })
      .filter(Boolean),
  };
}

export default function ParcelMap({ projectId, onParcelSelect, selectedParcelId, height = '500px' }: ParcelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const fittedRef = useRef(false);
  const clickedParcelRef = useRef<string>('');
  const mapReadyRef = useRef(false);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [satelliteEnabled, setSatelliteEnabled] = useState(true);
  const [corridorMode, setCorridorMode] = useState(false);
  const corridorPointsRef = useRef<[number, number][]>([]);
  const [corridorCount, setCorridorCount] = useState<number | null>(null);
  const corridorModeRef = useRef(false);
  const finishCorridorRef = useRef<() => Promise<void>>(async () => {});
  corridorModeRef.current = corridorMode;

  const { geoJson, data: parcels = [] } = useParcelsGeoJson(null, projectId);

  // Filter geojson by search + status before adding to map
  const filtered = useMemo(() => ({
    ...geoJson,
    features: geoJson.features.filter((f) => {
      const pn = String(f.properties.parcel_number ?? '');
      const status = String(f.properties.status ?? '');
      if (filter !== 'all' && status !== filter) return false;
      if (search && !pn.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
  }), [geoJson, filter, search]);

  // Latest data for the (async) load handler — prevents the GeoJSON source
  // being seeded from the stale first-render `filtered` (which is still empty).
  const dataRef = useRef(filtered);
  dataRef.current = filtered;

  // Centroid dots ref — keeps dots in sync with parcels via the same pattern.
  const dotsRef = useRef(makeDots(filtered.features));
  dotsRef.current = makeDots(filtered.features);

  // Swap the base raster tiles: satellite (Esri) <-> light (CARTO Positron)
  const syncBasemap = (map: maplibregl.Map, satellite: boolean) => {
    if (map.getLayer('base')) map.removeLayer('base');
    if (map.getSource('base')) map.removeSource('base');
    map.addSource('base', {
      type: 'raster',
      tiles: satellite ? [SATELLITE_TILE_URL] : BASE_TILES,
      tileSize: 256,
      attribution: satellite ? 'Esri, Maxar, Earthstar Geographics' : '© OpenStreetMap contributors © CARTO',
    });
    const beforeId = map.getLayer('parcels-fill') ? 'parcels-fill' : undefined;
    map.addLayer({ id: 'base', type: 'raster', source: 'base' }, beforeId);
  };

  // Zoom to a parcel + persist its status-coloured highlight. Used by map clicks
  // and by list-row selection (selectedParcelId) — the missing zoom on row click.
  const focusParcel = (map: maplibregl.Map, parcelNumber: string, geometry?: unknown) => {
    clickedParcelRef.current = parcelNumber;
    if (map.getLayer('parcels-highlight')) map.setFilter('parcels-highlight', ['==', ['get', 'parcel_number'], parcelNumber]);
    const b = new maplibregl.LngLatBounds();
    extendFeatureBounds(b, geometry as { coordinates?: unknown });
    if (!b.isEmpty()) map.fitBounds(b, { padding: 80, maxZoom: 17, duration: 700 });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    syncBasemap(map, satelliteEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satelliteEnabled]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          base: {
            type: 'raster',
            tiles: [SATELLITE_TILE_URL],
            tileSize: 256,
            attribution: 'Esri, Maxar, Earthstar Geographics',
          },
        },
        layers: [{ id: 'base', type: 'raster', source: 'base' }],
      },
      center: INDIA_CENTER,
      zoom: 4,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // ResizeObserver: re-run map.resize() when the container gets its real size.
    // Fixes stale viewport when mounted inside Suspense / lazy chunk.
    const ro = new ResizeObserver(() => { map.resize(); });
    ro.observe(containerRef.current);

    map.on('load', () => {
      map.addSource('parcels', { type: 'geojson', data: dataRef.current as unknown as never });

      // Fill layer — color by status (using feature property)
      map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: 'parcels',
        paint: {
          'fill-color': [
            'match',
            ['get', 'status'],
            'identified', STATUS_LEGEND.identified,
            'notified', STATUS_LEGEND.notified,
            'surveyed', STATUS_LEGEND.surveyed,
            'acquired', STATUS_LEGEND.acquired,
            'disputed', STATUS_LEGEND.disputed,
            '#CBD5E1',
          ],
          'fill-opacity': 0.6,
        },
      });

      map.addLayer({
        id: 'parcels-outline',
        type: 'line',
        source: 'parcels',
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'identified', '#60A5FA',
            'notified', '#FBBF24',
            'surveyed', '#2DD4BF',
            'acquired', '#34D399',
            'disputed', '#FB7185',
            '#CBD5E1',
          ],
          'line-width': 2.5,
          'line-opacity': 1,
        },
      });

      // Hover/click: highlight boundary in the parcel's own status colour
      map.addLayer({
        id: 'parcels-highlight',
        type: 'line',
        source: 'parcels',
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'identified', '#3B82F6',
            'notified', '#F59E0B',
            'surveyed', '#14B8A6',
            'acquired', '#22C55E',
            'disputed', '#EF4444',
            '#38bdf8',
          ],
          'line-width': 3,
        },
        filter: ['==', ['get', 'parcel_number'], ''],
      });

      // Corridor alignment layers (empty until drawn)
      map.addSource('corridor', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never });
      map.addLayer({ id: 'corridor-line', type: 'line', source: 'corridor', paint: { 'line-color': '#DC2626', 'line-width': 3, 'line-dasharray': [2, 1] } });
      map.addSource('corridor-hits', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never });
      map.addLayer({ id: 'corridor-hits-fill', type: 'fill', source: 'corridor-hits', paint: { 'fill-color': '#DC2626', 'fill-opacity': 0.25 } });
      map.addLayer({ id: 'corridor-hits-line', type: 'line', source: 'corridor-hits', paint: { 'line-color': '#DC2626', 'line-width': 2 } });

      // Centroid dots source + layer — visible circles at each parcel's center
      // regardless of whether polygon fill/outline paint.
      map.addSource('parcels-dots', { type: 'geojson', data: dotsRef.current as never });
      map.addLayer({
        id: 'parcels-dots',
        type: 'circle',
        source: 'parcels-dots',
        paint: {
          'circle-color': [
            'match', ['get', 'status'],
            'identified', '#3B82F6', 'notified', '#F59E0B',
            'surveyed', '#14B8A6', 'acquired', '#22C55E',
            'disputed', '#EF4444', '#38bdf8',
          ],
          'circle-radius': 7,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });

      // Guarantee the basemap raster sits below ALL vector layers,
      // even after a satellite-toggle re-adds 'base'.
      if (map.getLayer('base')) map.moveLayer('base', 'parcels-fill');

      // Corridor drawing: single click adds a point, double click runs the query.
      // Outside corridor mode, a click on empty map clears the persistent highlight.
      map.on('click', (e: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }) => {
        if (corridorModeRef.current) {
          corridorPointsRef.current.push([e.lngLat.lng, e.lngLat.lat]);
          const fc = {
            type: 'FeatureCollection',
            features: corridorPointsRef.current.length >= 2
              ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: corridorPointsRef.current }, properties: {} }]
              : [],
          };
          (map.getSource('corridor') as maplibregl.GeoJSONSource)?.setData(fc as never);
          return;
        }
        if (!map.queryRenderedFeatures([e.point.x, e.point.y], { layers: ['parcels-fill', 'parcels-dots'] }).length) {
          clickedParcelRef.current = '';
          map.setFilter('parcels-highlight', ['==', ['get', 'parcel_number'], '']);
        }
      });
      map.on('dblclick', (e: { originalEvent: Event }) => {
        if (!corridorModeRef.current) return;
        e.originalEvent.preventDefault();
        void finishCorridorRef.current();
      });

      map.on('mousemove', 'parcels-fill', (e: { features?: { properties: Record<string, unknown> }[] }) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (f) map.setFilter('parcels-highlight', ['==', ['get', 'parcel_number'], f.properties.parcel_number as string]);
      });
      map.on('mousemove', 'parcels-dots', (e: { features?: { properties: Record<string, unknown> }[] }) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (f) map.setFilter('parcels-highlight', ['==', ['get', 'parcel_number'], f.properties.parcel_number as string]);
      });
      map.on('mouseleave', 'parcels-fill', () => {
        map.getCanvas().style.cursor = '';
        // Snap back to the clicked parcel (if any) instead of clearing entirely
        map.setFilter('parcels-highlight', ['==', ['get', 'parcel_number'], clickedParcelRef.current]);
      });
      map.on('mouseleave', 'parcels-dots', () => {
        map.getCanvas().style.cursor = '';
        map.setFilter('parcels-highlight', ['==', ['get', 'parcel_number'], clickedParcelRef.current]);
      });

      // Click → zoom to parcel + popup + callback
      map.on('click', 'parcels-fill', (e: { features?: { properties: Record<string, unknown>; geometry?: { coordinates?: number[][][] } }[]; lngLat: maplibregl.LngLat }) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as Record<string, unknown>;
        const parcel = (props._parcel as Parcel | undefined) ?? (props as unknown as Parcel);

        focusParcel(map, String(props.parcel_number ?? ''), f.geometry);

        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeOnClick: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;padding:4px;min-width:160px"><div style="font-weight:600;font-size:13px">${props.parcel_number}</div><div style="font-size:12px;color:#475569">Owner: ${props.owner_name ?? '-'}<br/>Status: ${props.status}<br/>Area: ${props.area_hectares ?? '-'} ha</div></div>`,
          )
          .addTo(map);

        if (parcel && onParcelSelect) onParcelSelect(parcel);
      });
      map.on('click', 'parcels-dots', (e: { features?: { properties: Record<string, unknown>; geometry?: unknown }[]; lngLat: maplibregl.LngLat }) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as Record<string, unknown>;
        const parcel = (props._parcel as Parcel | undefined) ?? (props as unknown as Parcel);

        // Look up the full polygon geometry from the parcels source for proper zoom
        const polyFeat = dataRef.current.features.find(
          (p) => String(p.properties?.parcel_number) === String(props.parcel_number),
        );
        focusParcel(map, String(props.parcel_number ?? ''), polyFeat?.geometry ?? f.geometry);

        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeOnClick: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;padding:4px;min-width:160px"><div style="font-weight:600;font-size:13px">${props.parcel_number}</div><div style="font-size:12px;color:#475569">Owner: ${props.owner_name ?? '-'}<br/>Status: ${props.status}</div></div>`,
          )
          .addTo(map);

        if (parcel && onParcelSelect) onParcelSelect(parcel);
      });

      // Fit to parcels if available (use latest data, not the stale first-render closure)
      if (dataRef.current.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        dataRef.current.features.forEach((f) => extendFeatureBounds(bounds, f.geometry));
        map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
        fittedRef.current = true;
      }

      mapReadyRef.current = true;
    });

    mapRef.current = map;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update source data when filtered changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('parcels')) return;
    const src = map.getSource('parcels') as maplibregl.GeoJSONSource;
    src.setData(filtered as unknown as never);
    // Also sync centroid dots so circles stay visible
    const dotsSrc = map.getSource('parcels-dots') as maplibregl.GeoJSONSource | undefined;
    if (dotsSrc) dotsSrc.setData(dotsRef.current as never);
    // Force canvas to re-layout + repaint after vector data arrives
    map.resize();
    map.triggerRepaint();
    // Parcels load async — fit to their bounds once, the first time data arrives
    if (!fittedRef.current && filtered.features.length) {
      const bounds = new maplibregl.LngLatBounds();
      filtered.features.forEach((f) => extendFeatureBounds(bounds, f.geometry));
      map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
      fittedRef.current = true;
    }
  }, [filtered]);

  // Highlight selected parcel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('parcels-highlight')) return;
    if (selectedParcelId) {
      const feat = filtered.features.find((f) => f.id === selectedParcelId);
      if (feat) focusParcel(map, String(feat.properties.parcel_number ?? ''), feat.geometry);
    }
  }, [selectedParcelId, filtered]);

  const handleToggleSatellite = () => setSatelliteEnabled((prev) => !prev);

  // Corridor alignment: click to draw a line, double-click to run ST_Intersects via RPC
  const handleToggleCorridor = () => {
    const next = !corridorMode;
    setCorridorMode(next);
    setCorridorCount(null);
    corridorPointsRef.current = [];
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = next ? 'crosshair' : '';
    if (!next && map.getSource('corridor')) (map.getSource('corridor') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] } as never);
    if (!next && map.getSource('corridor-hits')) (map.getSource('corridor-hits') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] } as never);
  };

  const finishCorridor = async () => {
    const map = mapRef.current;
    const pts = corridorPointsRef.current;
    if (!map || pts.length < 2) return;
    try {
      const hits = await getParcelsIntersectingCorridor({ type: 'LineString', coordinates: pts } as never);
      setCorridorCount(hits.length);
      const fc = {
        type: 'FeatureCollection',
        features: hits.map((p) => ({
          type: 'Feature',
          geometry: p.geometry as never,
          properties: { parcel_number: p.parcel_number },
        })),
      };
      const src = map.getSource('corridor-hits') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(fc as never);
      toast.success(`${hits.length} parcel(s) intersect the corridor`);
    } catch (e) {
      toast.error(`Corridor query failed: ${(e as Error).message}`);
    }
  };
  finishCorridorRef.current = finishCorridor;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('corridor')) return;
    const fc = {
      type: 'FeatureCollection',
      features: corridorPointsRef.current.length >= 2
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: corridorPointsRef.current }, properties: {} }]
        : [],
    };
    (map.getSource('corridor') as maplibregl.GeoJSONSource).setData(fc as never);
  }, [corridorMode, corridorCount]);

  return (
    <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-[#0c0c0c]" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" aria-label="Parcel map" role="application" />
      <MapControls
        filter={filter}
        onFilter={setFilter}
        search={search}
        onSearch={setSearch}
        legend={STATUS_LEGEND}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        statusColor={statusColor}
        satelliteEnabled={satelliteEnabled}
        onToggleSatellite={handleToggleSatellite}
        corridorMode={corridorMode}
        onToggleCorridor={handleToggleCorridor}
        corridorCount={corridorCount}
      />
      {!filtered.features.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 pointer-events-none">
          <span className="text-sm text-slate-200 bg-[#0c0c0c] border border-slate-700 rounded-full px-3 py-1 shadow-sm">
            {parcels.length ? `${parcels.length} parcel(s) loaded, but none have map geometry` : 'No parcels match filters'}
          </span>
        </div>
      )}
    </div>
  );
}
