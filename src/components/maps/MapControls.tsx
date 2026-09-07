import { Search, ZoomIn, ZoomOut, MapPin, Satellite, Route } from 'lucide-react';

interface MapControlsProps {
  filter: string;
  onFilter: (v: string) => void;
  search: string;
  onSearch: (v: string) => void;
  legend: Record<string, string>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  statusColor: (s: string) => string;
  satelliteEnabled: boolean;
  onToggleSatellite: () => void;
  corridorMode: boolean;
  onToggleCorridor: () => void;
  corridorCount: number | null;
}

export default function MapControls({
  filter,
  onFilter,
  search,
  onSearch,
  legend,
  onZoomIn,
  onZoomOut,
  satelliteEnabled,
  onToggleSatellite,
  corridorMode,
  onToggleCorridor,
  corridorCount,
}: MapControlsProps) {

  return (
    <div className="absolute top-3 left-3 right-3 flex flex-col gap-2 pointer-events-none">
      {/* Top bar: search + filter */}
      <div className="flex flex-wrap gap-2 pointer-events-auto">
        <div className="flex-1 min-w-48 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center px-3 h-9">
          <Search size={16} className="text-slate-400 mr-2 shrink-0" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search parcel number…"
            className="w-full text-sm outline-none placeholder:text-slate-400"
            aria-label="Search parcels"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1] cursor-pointer"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {Object.keys(legend).map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <button
            onClick={onToggleCorridor}
            className={`h-9 px-3 rounded-lg shadow-sm text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              corridorMode ? 'bg-red-600 text-white border-red-600' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            aria-label="Toggle corridor alignment drawing"
            title="Draw a project corridor: click points on the map, double-click to match parcels"
          >
            <Route size={14} /> {corridorMode ? 'Drawing… (dbl-click to finish)' : corridorCount != null ? `Corridor: ${corridorCount} hit${corridorCount === 1 ? '' : 's'}` : 'Corridor'}
          </button>
          <button onClick={onZoomIn} aria-label="Zoom in" className="w-9 h-9 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center hover:bg-slate-50 cursor-pointer">
            <ZoomIn size={16} />
          </button>
          <button onClick={onZoomOut} aria-label="Zoom out" className="w-9 h-9 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center hover:bg-slate-50 cursor-pointer">
            <ZoomOut size={16} />
          </button>
        </div>
      </div>

      {/* Bottom: legend + satellite toggle */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 pointer-events-auto">
          <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
            <MapPin size={12} /> Status Legend
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(legend).map(([status, color]) => (
              <span key={status} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 rounded-sm border border-slate-200" style={{ background: color }} aria-hidden />
                {status}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onToggleSatellite}
          className={`h-8 px-3 rounded-lg shadow-sm text-xs font-medium flex items-center gap-1.5 pointer-events-auto cursor-pointer transition-colors ${
            satelliteEnabled
              ? 'bg-[#0F172A] text-white border-[#0F172A]'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          aria-label={satelliteEnabled ? 'Disable satellite layer' : 'Enable satellite layer'}
        >
          <Satellite size={14} /> Satellite
        </button>
      </div>
    </div>
  );
}
