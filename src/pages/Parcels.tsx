import { useState, useMemo } from 'react';
import { Search, Plus, Upload, MapPin, AlertTriangle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import { useParcels, useCreateParcel } from '../hooks/useParcels';
import { useDocuments } from '../hooks/useDocuments';
import { useStages, useAdvanceStage } from '../hooks/useStages';
import { useHearings } from '../hooks/useHearings';
import { useCompensation } from '../hooks/useCompensation';
import { useAuditLogs } from '../hooks/useAudit';
import { useRiskAssessments } from '../hooks/useRisk';
import ParcelMap from '../components/maps/ParcelMap';
import { Table } from '../components/ui/Table';
import { Badge, statusToBadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import StageTimeline from '../components/parcels/StageTimeline';
import DocumentList from '../components/documents/DocumentList';
import { useProject } from '../context/ProjectContext';
import type { Parcel, AcquisitionStage } from '../lib/types';
import { canAdvance, STAGES } from '../lib/stages';

const TABS = ['Overview', 'Documents', 'Timeline', 'Hearings', 'Compensation', 'Audit'] as const;

export default function Parcels() {
  const { projectId } = useProject();
  const { data: parcels = [], isLoading } = useParcels(null, projectId ?? undefined);
  const createParcel = useCreateParcel();
  const advanceStage = useAdvanceStage();
  const [advanceConfirm, setAdvanceConfirm] = useState<{ stage: AcquisitionStage; def: typeof STAGES[0] } | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ parcel_number: '', owner_name: '', area_hectares: '' });
  const pageSize = 8;

  const filtered = useMemo(() => {
    return parcels.filter((p) => {
      if (debouncedSearch && !p.parcel_number.toLowerCase().includes(debouncedSearch.toLowerCase()) && !p.owner_name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterRisk !== 'all') {
        const lvl = (p.risk_score ?? 0) > 0.8 ? 'critical' : (p.risk_score ?? 0) > 0.6 ? 'high' : (p.risk_score ?? 0) > 0.3 ? 'medium' : 'low';
        if (lvl !== filterRisk) return false;
      }
      if (projectId && p.project_id !== projectId) return false;
      return true;
    });
  }, [parcels, debouncedSearch, filterStatus, filterRisk, projectId]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Detail hooks (only when selected)
  const { data: docs = [] } = useDocuments(selected?.id);
  const { data: stages = [] } = useStages(selected?.id);
  const { data: hearings = [] } = useHearings(selected?.id);
  const { data: awards = [] } = useCompensation(selected?.id);
  const { data: audits = [] } = useAuditLogs(selected?.id);
  const { data: risks = [] } = useRiskAssessments(selected?.id);

  const handleCsv = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      const lines = text.split('\n').filter(Boolean);
      const headers = lines[0]?.split(',').map((h) => h.trim().toLowerCase());
      const idxNum = headers.indexOf('parcel_number');
      const idxOwner = headers.indexOf('owner_name');
      const idxArea = headers.indexOf('area_hectares');
      if (idxNum === -1 || idxOwner === -1) {
        toast.error('CSV must have parcel_number, owner_name, area_hectares columns');
        return;
      }
      const toCreate = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        return {
          parcel_number: cols[idxNum],
          owner_name: cols[idxOwner],
          area_hectares: Number(cols[idxArea] ?? 1),
          project_id: projectId ?? parcels[0]?.project_id,
          status: 'identified' as const,
          geometry: null,
        };
      });
      toCreate.forEach((p) => {
        if (p.parcel_number && p.owner_name) createParcel.mutate(p as unknown as Parcel);
      });
      toast.success(`Queued ${toCreate.length} parcels from CSV`);
    };
    reader.readAsText(file);
  };

  const handleStageClick = (stage: AcquisitionStage | undefined, def: typeof STAGES[0]) => {
    if (!stage || !selected) return;
    // Only allow advancing the current in_progress stage
    if (stage.status !== 'in_progress') return;
    setAdvanceConfirm({ stage, def });
  };

  const confirmAdvance = () => {
    if (!advanceConfirm || !selected) return;
    const { stage, def } = advanceConfirm;
    // Validate can advance
    const check = canAdvance(stages, def.stage_number);
    if (!check.ok) {
      toast.error(check.reason ?? 'Cannot advance');
      setAdvanceConfirm(null);
      return;
    }
    advanceStage.mutate(
      { stageId: stage.id, parcelId: selected.id, currentStages: stages, targetNumber: def.stage_number },
      {
        onSuccess: () => {
          toast.success(`Advanced to ${def.stage_name}`);
        },
      },
    );
    setAdvanceConfirm(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Top: Search + filters + actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-64 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search parcel number or owner…"
            className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer">
          <option value="all">All status</option>
          <option value="identified">Identified</option>
          <option value="notified">Notified</option>
          <option value="surveyed">Surveyed</option>
          <option value="acquired">Acquired</option>
          <option value="disputed">Disputed</option>
        </select>
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer">
          <option value="all">All risk</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <label className="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white flex items-center gap-1 cursor-pointer hover:bg-slate-50">
          <Upload size={14} /> Bulk CSV
          <input type="file" accept=".csv" className="hidden" onChange={(e) => handleCsv(e.target.files?.[0] ?? null)} />
        </label>
        <Button onClick={() => setShowAdd(true)} leftIcon={<Plus size={16} />}>Add New Parcel</Button>
      </div>

      {/* Middle: Table left + Map right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading parcels…</div>
          ) : (
            <>
              <Table
                columns={[
                  { key: 'parcel_number', header: 'Parcel #' , sortable: true },
                  { key: 'owner_name', header: 'Owner', sortable: true },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (r) => <Badge variant={statusToBadgeVariant(String((r as unknown as Parcel).status))}>{String((r as unknown as Parcel).status)}</Badge>,
                  },
                  { key: 'area_hectares', header: 'Area ha', sortable: true, accessor: (r) => String((r as unknown as Parcel).area_hectares) },
                  {
                    key: 'risk_score',
                    header: 'Risk',
                    render: (r) => {
                      const v = (r as unknown as Parcel).risk_score;
                      return v != null ? <span className={`px-1.5 py-0.5 rounded text-xs border ${Number(v) > 0.6 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{String(v)}</span> : '-';
                    },
                  },
                ]}
                data={paged as unknown as Record<string, unknown>[]}
                onRowClick={(r) => {
                  const parcel = parcels.find((p) => p.parcel_number === String((r as unknown as Parcel).parcel_number));
                  if (parcel) {
                    setSelected(parcel);
                    setTab('Overview');
                  }
                }}
              />
              <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                <span>
                  {filtered.length} parcels • Page {page}/{totalPages}
                </span>
                <div className="flex gap-1">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </Button>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1">
            <MapPin size={14} /> {selected ? `Location: ${selected.parcel_number}` : 'Select a parcel to locate'}
          </h3>
          {selected ? (
            <ParcelMap projectId={projectId ?? undefined} selectedParcelId={selected.id} height="380px" />
          ) : (
            <ParcelMap projectId={projectId ?? undefined} height="380px" />
          )}
        </div>
      </div>

      {/* Bottom: Detail tabs */}
      {selected && (
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${tab === t ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {t}
              </button>
            ))}
            <button onClick={() => setSelected(null)} className="ml-auto text-xs text-slate-500 hover:text-slate-700">
              Close
            </button>
          </div>

          <div className="p-4">
            {tab === 'Overview' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-slate-500 text-xs">Owner</div><div className="font-medium">{selected.owner_name}</div></div>
                <div><div className="text-slate-500 text-xs">Area</div><div className="font-medium">{selected.area_hectares} ha</div></div>
                <div><div className="text-slate-500 text-xs">Status</div><Badge variant={statusToBadgeVariant(selected.status)}>{selected.status}</Badge></div>
                <div><div className="text-slate-500 text-xs">Risk</div><div className="font-medium">{selected.risk_score ?? '-'}</div></div>
                <div><div className="text-slate-500 text-xs">Risk Level</div><div>{risks[0]?.risk_level ?? '-'}</div></div>
                <div><div className="text-slate-500 text-xs">Village/District</div><div className="font-medium">{(selected as unknown as Record<string, unknown>).village as string ?? '-'} / {(selected as unknown as Record<string, unknown>).district as string ?? '-'}</div></div>
              </div>
            )}
            {tab === 'Documents' && <DocumentList parcelId={selected.id} />}
            {tab === 'Timeline' && <StageTimeline stages={stages} onStageClick={handleStageClick} />}
            {tab === 'Hearings' && (
              <div className="space-y-2">
                {hearings.length === 0 ? <div className="text-sm text-slate-500">No hearings linked</div> : hearings.map((h) => <div key={h.id} className="border border-slate-200 rounded-lg p-3 text-sm"><div className="font-medium">{h.type} — {new Date(h.hearing_date).toLocaleString()}</div><div className="text-slate-600">{h.outcome ?? h.notes ?? '-'}</div></div>)}
              </div>
            )}
            {tab === 'Compensation' && (
              <div className="space-y-2">
                {awards.length === 0 ? <div className="text-sm text-slate-500">No awards</div> : awards.map((a) => <div key={a.id} className="border border-slate-200 rounded-lg p-3 text-sm flex justify-between"><span>₹{Number(a.awarded_amount).toLocaleString('en-IN')} • {a.payment_status}</span><Badge variant={a.payment_status === 'completed' ? 'success' : 'warning'}>{a.payment_status}</Badge></div>)}
              </div>
            )}
            {tab === 'Audit' && (
              <div className="space-y-2">
                {audits.length === 0 ? <div className="text-sm text-slate-500">No audit entries</div> : audits.map((a) => <div key={a.id} className="border border-slate-200 rounded-lg p-3 text-sm"><div className="font-medium">{a.audit_type} • {a.severity}</div><div className="text-slate-600">{a.finding}</div></div>)}
                {docs.length > 0 && <div className="text-xs text-slate-400">{docs.length} documents linked</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add parcel modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Parcel">
        <div className="space-y-3">
          <Input label="Parcel number" requiredIndicator value={addForm.parcel_number} onChange={(e) => setAddForm((p) => ({ ...p, parcel_number: e.target.value }))} />
          <Input label="Owner name" requiredIndicator value={addForm.owner_name} onChange={(e) => setAddForm((p) => ({ ...p, owner_name: e.target.value }))} />
          <Input label="Area (hectares)" type="number" value={addForm.area_hectares} onChange={(e) => setAddForm((p) => ({ ...p, area_hectares: e.target.value }))} />
          <Button
            onClick={() => {
              if (!addForm.parcel_number.trim() || !addForm.owner_name.trim()) {
                toast.error('Parcel number and owner required');
                return;
              }
              createParcel.mutate(
                {
                  parcel_number: addForm.parcel_number.trim(),
                  owner_name: addForm.owner_name.trim(),
                  area_hectares: Number(addForm.area_hectares || 1),
                  project_id: projectId ?? parcels[0]?.project_id,
                  status: 'identified',
                  geometry: null,
                } as unknown as Parcel,
                {
                  onSuccess: () => {
                    setShowAdd(false);
                    setAddForm({ parcel_number: '', owner_name: '', area_hectares: '' });
                  },
                },
              );
            }}
            loading={createParcel.isPending}
            className="w-full"
          >
            Create Parcel
          </Button>
          <div className="text-xs text-slate-500">CSV bulk: columns parcel_number, owner_name, area_hectares</div>
        </div>
      </Modal>

      {/* Advance stage confirmation modal */}
      {advanceConfirm && (
        <Modal open={true} onClose={() => setAdvanceConfirm(null)} title="Advance Stage">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={24} className="text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-slate-900">Advance to <strong>{advanceConfirm.def.stage_name}</strong>?</p>
                <p className="text-sm text-slate-600">Parcel: {selected?.parcel_number} — Current stage: {advanceConfirm.stage.stage_name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              This will mark the current stage as completed and move the next stage to in_progress.
              {advanceStage.isPending && ' Processing…'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAdvanceConfirm(null)} disabled={advanceStage.isPending}>
                Cancel
              </Button>
              <Button onClick={confirmAdvance} loading={advanceStage.isPending} leftIcon={advanceStage.isPending ? undefined : <AlertCircle size={14} />}>
                Confirm Advance
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
