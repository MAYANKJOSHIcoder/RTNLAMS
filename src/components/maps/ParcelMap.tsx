import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import toast from 'react-hot-toast';
import { useParcelsGeoJson, statusColor } from '../../hooks/useParcels';
import { getParcelsIntersectingCorridor } from '../../lib/supabase/queries';
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

export default function ParcelMap({ projectId, onParcelSelect, selectedParcelId, height = '500px' }: ParcelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [satelliteEnabled, setSatelliteEnabled] = useState(false);
  const [corridorMode, setCorridorMode] = useState(false);
  const corridorPointsRef = useRef<[number, number][]>([]);
  const [corridorCount, setCorridorCount] = useState<number | null>(null);
  const corridorModeRef = useRef(false);
  const finishCorridorRef = useRef<() => Promise<void>>(async () => {});
  corridorModeRef.current = corridorMode;

  const { geoJson } = useParcelsGeoJson(null, projectId);

  // Filter geojson by search + status before adding to map
  const filtered = {
    ...geoJson,
    features: geoJson.features.filter((f) => {
      const pn = String(f.properties.parcel_number ?? '');
      const status = String(f.properties.status ?? '');
      if (filter !== 'all' && status !== filter) return false;
      if (search && !pn.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
  };

  // Add/remove satellite layer when toggled
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sourceId = 'satellite';
    const layerId = 'satellite-layer';
    if (satelliteEnabled) {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [SATELLITE_TILE_URL],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics',
        });
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
        }); // above OSM (opaque) so satellite is visible; parcel layers were added last → stay on top
      }
    } else {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }, [satelliteEnabled]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: INDIA_CENTER,
      zoom: 4,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('parcels', { type: 'geojson', data: filtered as unknown as never });

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
          'line-color': '#0F172A',
          'line-width': 1.5,
          'line-opacity': 0.9,
        },
      });

      // Hover: highlight boundary width
      map.addLayer({
        id: 'parcels-highlight',
        type: 'line',
        source: 'parcels',
        paint: { 'line-color': '#0369A1', 'line-width': 3 },
        filter: ['==', ['get', 'parcel_number'], ''],
      });

      // Corridor alignment layers (empty until drawn)
      map.addSource('corridor', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never });
      map.addLayer({ id: 'corridor-line', type: 'line', source: 'corridor', paint: { 'line-color': '#DC2626', 'line-width': 3, 'line-dasharray': [2, 1] } });
      map.addSource('corridor-hits', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never });
      map.addLayer({ id: 'corridor-hits-fill', type: 'fill', source: 'corridor-hits', paint: { 'fill-color': '#DC2626', 'fill-opacity': 0.25 } });
      map.addLayer({ id: 'corridor-hits-line', type: 'line', source: 'corridor-hits', paint: { 'line-color': '#DC2626', 'line-width': 2 } });

      // Corridor drawing: single click adds a point, double click runs the query
      map.on('click', (e: { lngLat: { lng: number; lat: number } }) => {
        if (!corridorModeRef.current) return;
        corridorPointsRef.current.push([e.lngLat.lng, e.lngLat.lat]);
        const fc = {
          type: 'FeatureCollection',
          features: corridorPointsRef.current.length >= 2
            ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: corridorPointsRef.current }, properties: {} }]
            : [],
        };
        (map.getSource('corridor') as maplibregl.GeoJSONSource)?.setData(fc as never);
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
      map.on('mouseleave', 'parcels-fill', () => {
        map.getCanvas().style.cursor = '';
        map.setFilter('parcels-highlight', ['==', ['get', 'parcel_number'], '']);
      });

      // Click → popup + callback
      map.on('click', 'parcels-fill', (e: { features?: { properties: Record<string, unknown> }[]; lngLat: maplibregl.LngLat }) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as Record<string, unknown>;
        const parcel = (props._parcel as Parcel | undefined) ?? (props as unknown as Parcel);

        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeOnClick: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;padding:4px;min-width:160px"><div style="font-weight:600;font-size:13px">${props.parcel_number}</div><div style="font-size:12px;color:#475569">Owner: ${props.owner_name ?? '-'}<br/>Status: ${props.status}<br/>Area: ${props.area_hectares ?? '-'} ha</div></div>`,
          )
          .addTo(map);

        if (parcel && onParcelSelect) onParcelSelect(parcel);
      });

      // Fit to parcels if available
      if (filtered.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        filtered.features.forEach((f) => {
          const geom = f.geometry as { coordinates: number[][][] };
          geom.coordinates[0].forEach(([lng, lat]) => bounds.extend([lng, lat]));
        });
        map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
      }
    });

    mapRef.current = map;
    return () => {
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
  }, [filtered]);

  // Highlight selected parcel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('parcels-highlight')) return;
    if (selectedParcelId) {
      const feat = filtered.features.find((f) => f.id === selectedParcelId);
      if (feat) map.setFilter('parcels-highlight', ['==', ['get', 'parcel_number'], feat.properties.parcel_number as string]);
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
    <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-white" style={{ height }}>
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
          <span className="text-sm text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm">No parcels match filters</span>
        </div>
      )}
    </div>
  );
}
