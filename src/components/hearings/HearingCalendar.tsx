import { useState } from 'react';
import { Calendar, Filter } from 'lucide-react';
import { useHearingsCalendar } from '../../hooks/useHearings';
import type { Hearing } from '../../lib/types';

const TYPE_COLOR: Record<string, string> = {
  objection: 'bg-amber-100 text-amber-800 border-amber-200',
  valuation: 'bg-blue-100 text-blue-800 border-blue-200',
  final: 'bg-green-100 text-green-800 border-green-200',
  public: 'bg-purple-100 text-purple-800 border-purple-200',
};

interface HearingCalendarProps {
  onSelect?: (h: Hearing) => void;
}

export default function HearingCalendar({ onSelect }: HearingCalendarProps) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterType, setFilterType] = useState('all');
  const { data: hearings = [], isLoading } = useHearingsCalendar(month);

  const filtered = hearings.filter((h) => (filterType === 'all' ? true : h.type === filterType));

  // Group by date (YYYY-MM-DD)
  const grouped = filtered.reduce<Record<string, Hearing[]>>((acc, h) => {
    const d = new Date(h.hearing_date).toISOString().slice(0, 10);
    (acc[d] ??= []).push(h);
    return acc;
  }, {});

  const days = Object.keys(grouped).sort();

  return (
    <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Calendar size={16} /> Hearing Calendar
        </h3>
        <div className="flex gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-8 px-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#38bdf8]"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-8 px-2 border border-slate-300 rounded-md text-xs bg-[#0c0c0c] cursor-pointer"
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            <option value="objection">Objection</option>
            <option value="valuation">Valuation</option>
            <option value="final">Final</option>
            <option value="public">Public</option>
          </select>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500">
            <Filter size={12} /> {filtered.length} hearings
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-500">Loading calendar…</div>
      ) : days.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">No hearings for {month}</div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-auto">
          {days.map((d) => (
            <div key={d} className="border border-slate-100 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-700 mb-2">{new Date(d).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div className="space-y-2">
                {grouped[d].map((h) => (
                  <button
                    key={h.id}
                    onClick={() => onSelect?.(h)}
                    className="w-full text-left border border-slate-200 rounded-lg p-2.5 hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer"
                  >
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${TYPE_COLOR[h.type] ?? 'bg-slate-100'}`}>{h.type}</span>
                    <span className="text-xs text-slate-600 truncate flex-1">{new Date(h.hearing_date).toLocaleTimeString()} • {h.parcel_id.slice(0, 8)} • {h.outcome ? h.outcome.slice(0, 40) : 'No outcome yet'}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
