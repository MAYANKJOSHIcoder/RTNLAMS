import { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCreateHearing } from '../../hooks/useHearings';
import type { Hearing } from '../../lib/types';

interface HearingFormProps {
  parcelId: string;
  onSuccess?: () => void;
}

export default function HearingForm({ parcelId, onSuccess }: HearingFormProps) {
  const [hearingDate, setHearingDate] = useState('');
  const [type, setType] = useState<Hearing['type']>('objection');
  const [attendees, setAttendees] = useState<{ name: string; role: string }[]>([{ name: '', role: '' }]);
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [minutesFile, setMinutesFile] = useState<File | null>(null);
  const create = useCreateHearing();

  const handleAttendeeChange = (i: number, field: 'name' | 'role', val: string) => {
    setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: val } : a)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedAttendees = attendees.filter((a) => String(a.name).trim()).map((a) => ({ name: String(a.name).trim(), role: String(a.role).trim() }));
    // File upload for minutes: for MVP store filename placeholder; real upload would be Supabase Storage
    const minutes_file_url = minutesFile ? `minutes/${Date.now()}-${minutesFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}` : null;
    create.mutate(
      {
        parcel_id: parcelId,
        hearing_date: hearingDate,
        type,
        outcome: outcome || null,
        attendees: sanitizedAttendees.length ? (sanitizedAttendees as unknown as Hearing['attendees']) : null,
        notes: notes || null,
        minutes_file_url,
      },
      {
        onSuccess: () => {
          setHearingDate('');
          setOutcome('');
          setNotes('');
          setAttendees([{ name: '', role: '' }]);
          setMinutesFile(null);
          onSuccess?.();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="hearingDate" className="block text-sm font-medium text-slate-700 mb-1">
            Hearing date <span className="text-red-600">*</span>
          </label>
          <input
            id="hearingDate"
            type="datetime-local"
            required
            value={hearingDate}
            onChange={(e) => setHearingDate(e.target.value)}
            className="w-full h-11 px-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
          />
        </div>
        <div>
          <label htmlFor="hearingType" className="block text-sm font-medium text-slate-700 mb-1">
            Type <span className="text-red-600">*</span>
          </label>
          <select
            id="hearingType"
            value={type}
            onChange={(e) => setType(e.target.value as Hearing['type'])}
            className="w-full h-11 px-3 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0369A1] cursor-pointer"
          >
            <option value="objection">Objection</option>
            <option value="valuation">Valuation</option>
            <option value="final">Final</option>
            <option value="public">Public Hearing</option>
          </select>
        </div>
      </div>

      <Input label="Parcel" value={parcelId} disabled placeholder="Linked parcel ID" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">Attendees</label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAttendees((p) => [...p, { name: '', role: '' }])}
            leftIcon={<Plus size={14} />}
          >
            Add attendee
          </Button>
        </div>
        <div className="space-y-2">
          {attendees.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="Name"
                value={a.name}
                onChange={(e) => handleAttendeeChange(i, 'name', e.target.value)}
                className="flex-1 h-9 px-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
              />
              <input
                placeholder="Role"
                value={a.role}
                onChange={(e) => handleAttendeeChange(i, 'role', e.target.value)}
                className="flex-1 h-9 px-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setAttendees((p) => p.filter((_, idx) => idx !== i))} aria-label="Remove attendee">
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="outcome" className="block text-sm font-medium text-slate-700 mb-1">
          Outcome
        </label>
        <textarea
          id="outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="Hearing outcome summary…"
          className="w-full min-h-20 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes…"
          className="w-full min-h-16 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Hearing minutes (PDF)</label>
        <label className="flex items-center gap-2 h-11 px-3 border border-dashed border-slate-300 rounded-md text-sm cursor-pointer hover:bg-slate-50">
          <Upload size={16} /> {minutesFile ? minutesFile.name : 'Click to upload minutes'}
          <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setMinutesFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <Button type="submit" loading={create.isPending} className="w-full">
        Schedule Hearing
      </Button>
      {create.isError && <p className="text-xs text-red-600">{(create.error as Error).message}</p>}
    </form>
  );
}
