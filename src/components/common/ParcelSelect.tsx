import { useParcels } from '../../hooks/useParcels';
import type { Parcel } from '../../lib/types';

interface ParcelSelectProps {
  value: string; // parcel id or '' for all
  onChange: (parcelId: string) => void;
  allowAll?: boolean;
}

/**
 * Parcel dropdown shared by Documents/Hearings/Audit pages.
 * '' = "All parcels" (when allowAll).
 */
export default function ParcelSelect({ value, onChange, allowAll = true }: ParcelSelectProps) {
  const { data: parcels = [], isLoading } = useParcels(null, undefined);

  const label = (p: Parcel) => `${p.parcel_number} — ${p.owner_name}`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label htmlFor="parcel-select" className="text-sm font-medium text-slate-400">
        Parcel
      </label>
      <select
        id="parcel-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-64 px-3 border border-slate-300 rounded-lg text-sm bg-[#0c0c0c] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#38bdf8]"
      >
        {allowAll && <option value="">All parcels</option>}
        {isLoading && <option value="" disabled>Loading parcels…</option>}
        {parcels.map((p) => (
          <option key={p.id} value={p.id}>
            {label(p)}
          </option>
        ))}
      </select>
    </div>
  );
}
