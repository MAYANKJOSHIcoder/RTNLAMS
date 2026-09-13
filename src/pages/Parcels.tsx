import { useState, useMemo, Suspense, lazy, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Upload, MapPin, AlertTriangle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { useParcels, useCreateParcel } from '../hooks/useParcels';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useDocuments } from '../hooks/useDocuments';
import { useStages, useAdvanceStage } from '../hooks/useStages';
import { useHearings } from '../hooks/useHearings';
import { useCompensation } from '../hooks/useCompensation';
import { useAuditLogs } from '../hooks/useAudit';
import { useRiskAssessments } from '../hooks/useRisk';
import { useProject } from '../context/ProjectContext';
import { Table } from '../components/ui/Table';
import { Badge, statusToBadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import StageTimeline from '../components/parcels/StageTimeline';
import StageBoard from '../components/parcels/StageBoard';
import AddParcelModal from '../components/parcels/AddParcelModal';
import DocumentList from '../components/documents/DocumentList';
import type { Parcel, AcquisitionStage } from '../lib/types';
import { can } from '../lib/permissions';
import { STAGES } from '../lib/stages';
import { AREA_UNITS, UNIT_LABELS, formatArea, toHectares, SQM_PER_UNIT, type AreaUnit } from '../lib/units';

// maplibre-gl is ~260KB gzipped — load the map chunk only when its panel mounts
const ParcelMap = lazy(() => import('../components/maps/ParcelMap'));

const TABS = ['Overview', 'Documents', 'Timeline', 'Hearings', 'Compensation', 'Audit'] as const;

function pointToParcelPolygon(latitude?: string, longitude?: string): Parcel['geometry'] {
  if (!latitude || !longitude) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const d = 0.004;
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - d, lat - d],
      [lng + d, lat - d],
      [lng + d, lat + d],
      [lng - d, lat + d],
      [lng - d, lat - d],
    ]],
  };
}

export default function Parcels() {
  const { projectId } = useProject();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canCreate = can(profile?.role, 'parcel.create');
  const canAudit = can(profile?.role, 'audit.log');
  const { data: parcels = [], isLoading, isError, error: parcelsError } = useParcels(null, projectId ?? undefined);
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
  const [view, setView] = useState<'table' | 'board'>('table');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('hectare');
  const pageSize = 8;
  const [searchParams] = useSearchParams();

  // Deep link from citizen roadmap: /parcels?parcel={id} pre-selects the parcel
  useEffect(() => {
    const target = searchParams.get('parcel');
    if (!target) return;
    const p = parcels.find((x) => x.id === target);
    if (p) setSelected(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, parcels]);

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

  const handleCsv = async (file: File | null) => {
    if (!file) return;
    if (!projectId) {
      toast.error('Select a project before bulk import');
      return;
    }
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0]?.split(',').map((h) => h.trim().toLowerCase());
    const idxNum = headers.indexOf('parcel_number');
    const idxOwner = headers.indexOf('owner_name');
    const idxAadhaar = headers.indexOf('owner_aadhaar');
    const idxArea = headers.indexOf('area');
    const idxUnit = headers.indexOf('area_unit');
    const idxLat = headers.findIndex((h) => h === 'latitude' || h === 'lat');
    const idxLng = headers.findIndex((h) => h === 'longitude' || h === 'lng' || h === 'lon');
    if (idxNum === -1 || idxOwner === -1 || idxArea === -1) {
      toast.error('CSV must have parcel_number, owner_name, area columns (optional: owner_aadhaar, area_unit)');
      return;
    }
    const toCreate: { payload: Partial<Parcel>; area: number; unit: string }[] = [];
    const invalid: string[] = [];
    lines.slice(1).forEach((line, i) => {
      const cols = line.split(',').map((c) => c.trim());
      const unit = (cols[idxUnit] || 'hectare').toLowerCase();
      const aadhaar = idxAadhaar >= 0 ? cols[idxAadhaar] : '';
      const area = Number(cols[idxArea]);
      const latitude = idxLat >= 0 ? cols[idxLat] : '';
      const longitude = idxLng >= 0 ? cols[idxLng] : '';
      const hasLat = latitude !== '';
      const hasLng = longitude !== '';
      if (!cols[idxNum] || !cols[idxOwner] || !Number.isFinite(area) || area <= 0) {
        invalid.push(`row ${i + 2}`);
        return;
      }
      if (hasLat !== hasLng) {
        invalid.push(`row ${i + 2} (latitude and longitude must both be present)`);
        return;
      }
      if (hasLat && !pointToParcelPolygon(latitude, longitude)) {
        invalid.push(`row ${i + 2} (invalid latitude/longitude)`);
        return;
      }
      if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
        invalid.push(`row ${i + 2} (aadhaar not 12 digits)`);
        return;
      }
      if (!(unit in SQM_PER_UNIT)) {
        invalid.push(`row ${i + 2} (unknown unit "${unit}")`);
        return;
      }
      toCreate.push({
        payload: {
          parcel_number: cols[idxNum],
          owner_name: cols[idxOwner],
          owner_aadhaar: aadhaar || null,
          area_hectares: toHectares(area, unit as AreaUnit),
          project_id: projectId,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          geometry: pointToParcelPolygon(latitude, longitude),
        },
        area,
        unit,
      });
    });
    if (invalid.length) toast.error(`Skipped: ${invalid.join(', ')}`);
    if (!toCreate.length) {
      toast.error('Nothing to create — check CSV columns');
      return;
    }
    const results = await Promise.allSettled(
      toCreate.map((c) => createParcel.mutateAsync(c.payload)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    toast.success(`Created ${ok} parcels${failed ? `, ${failed} failed` : ''}`);
  };

  const handleStageClick = (stage: AcquisitionStage | undefined, def: typeof STAGES[0]) => {
    if (!stage || !selected) return;
    if (!can(profile?.role, 'stage.advance')) return;
    // Only allow advancing the current in_progress stage
    if (stage.status !== 'in_progress') return;
    setAdvanceConfirm({ stage, def });
  };

  const confirmAdvance = () => {
    if (!advanceConfirm || !selected) return;
    const { stage, def } = advanceConfirm;
    advanceStage.mutate(
      { stageId: stage.id, parcelId: selected.id },
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
      {isError && <ErrorBanner message={`Parcels failed to load: ${parcelsError?.message ?? 'check connection / RLS'}`} />}
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
            className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8]"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-[#0c0c0c] cursor-pointer">
          <option value="all">All status</option>
          <option value="identified">Identified</option>
          <option value="notified">Notified</option>
          <option value="surveyed">Surveyed</option>
          <option value="acquired">Acquired</option>
          <option value="disputed">Disputed</option>
        </select>
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-[#0c0c0c] cursor-pointer">
          <option value="all">All risk</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        {canCreate && (
          <label
            className={`h-10 px-3 border border-slate-300 rounded-lg text-sm flex items-center gap-1 ${projectId ? 'bg-[#0c0c0c] cursor-pointer hover:bg-white/[0.04]' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            title={projectId ? undefined : 'Select a project first'}
          >
            <Upload size={14} /> Bulk CSV
            <input type="file" accept=".csv" className="hidden" disabled={!projectId} onChange={(e) => handleCsv(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {canCreate && (
          <span title={projectId ? undefined : 'Select a project first'}>
            <Button onClick={() => setShowAdd(true)} disabled={!projectId} leftIcon={<Plus size={16} />}>Add New Parcel</Button>
          </span>
        )}
        <select
          value={areaUnit}
          onChange={(e) => setAreaUnit(e.target.value as AreaUnit)}
          title="Area display unit"
          className="h-10 px-2 border border-slate-300 rounded-lg text-xs bg-[#0c0c0c] cursor-pointer"
        >
          {AREA_UNITS.map((u) => (
            <option key={u} value={u}>{UNIT_LABELS[u]}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          {(['table', 'board'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 h-10 text-sm font-medium cursor-pointer ${view === v ? 'bg-white text-black' : 'bg-[#0c0c0c] text-slate-600 hover:bg-white/[0.04]'}`}
            >
              {v === 'table' ? 'Table' : 'Board'}
            </button>
          ))}
        </div>
      </div>

      {/* Board view */}
      {view === 'board' ? (
        <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-3">
          <StageBoard projectId={projectId ?? undefined} />
        </div>
      ) : (
      <>
      {/* Middle: Table left + Map right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-3">
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
                  { key: 'area_hectares', header: 'Area', sortable: true, accessor: (r) => String((r as unknown as Parcel).area_hectares), render: (r) => formatArea((r as unknown as Parcel).area_hectares, areaUnit) },
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

        <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-3">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1">
            <MapPin size={14} /> {selected ? `Location: ${selected.parcel_number}` : 'Select a parcel to locate'}
          </h3>
          <Suspense fallback={<div className="h-[380px] rounded-lg border border-slate-200 animate-pulse bg-white/[0.02] flex items-center justify-center text-xs text-slate-500">Loading map…</div>}>
            {selected ? (
              <ParcelMap projectId={projectId ?? undefined} selectedParcelId={selected.id} height="380px" />
            ) : (
              <ParcelMap projectId={projectId ?? undefined} height="380px" />
            )}
          </Suspense>
        </div>
      </div>
      </>
      )}

      {/* Bottom: Detail tabs */}
      {selected && (
        <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl">
          <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${tab === t ? 'bg-white text-black' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
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
                <div><div className="text-slate-500 text-xs">Area</div><div className="font-medium">{formatArea(selected.area_hectares, areaUnit)}</div></div>
                <div><div className="text-slate-500 text-xs">Status</div><Badge variant={statusToBadgeVariant(selected.status)}>{selected.status}</Badge></div>
                <div><div className="text-slate-500 text-xs">Risk</div><div className="font-medium">{selected.risk_score ?? '-'}</div></div>
                <div><div className="text-slate-500 text-xs">Risk Level</div><div>{risks[0]?.risk_level ?? '-'}</div></div>
                <div><div className="text-slate-500 text-xs">Village/District</div><div className="font-medium">{(selected as unknown as Record<string, unknown>).village as string ?? '-'} / {(selected as unknown as Record<string, unknown>).district as string ?? '-'}</div></div>
              </div>
            )}
            {tab === 'Documents' && (
              <div className="space-y-3">
                {can(profile?.role, 'document.upload') && (
                  <Button size="sm" leftIcon={<Upload size={14} />} onClick={() => navigate(`/documents/${selected.id}`)}>
                    Upload Document
                  </Button>
                )}
                <DocumentList parcelId={selected.id} />
              </div>
            )}
            {tab === 'Timeline' && <StageTimeline stages={stages} onStageClick={handleStageClick} />}
            {tab === 'Hearings' && (
              <div className="space-y-2">
                {can(profile?.role, 'hearing.schedule') && (
                  <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => navigate(`/hearings/${selected.id}`)}>
                    Schedule Hearing
                  </Button>
                )}
                {hearings.length === 0 ? <div className="text-sm text-slate-500">No hearings linked</div> : hearings.map((h) => <div key={h.id} className="border border-slate-200 rounded-lg p-3 text-sm"><div className="font-medium">{h.type} — {new Date(h.hearing_date).toLocaleString()}</div><div className="text-slate-600">{h.outcome ?? h.notes ?? '-'}</div></div>)}
              </div>
            )}
            {tab === 'Compensation' && (
              <div className="space-y-2">
                {can(profile?.role, 'award.record') && (
                  <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => navigate(`/compensation/${selected.id}`)}>
                    Record Award
                  </Button>
                )}
                {awards.length === 0 ? <div className="text-sm text-slate-500">No awards</div> : awards.map((a) => <div key={a.id} className="border border-slate-200 rounded-lg p-3 text-sm flex justify-between"><span>₹{Number(a.awarded_amount).toLocaleString('en-IN')} • {a.payment_status}</span><Badge variant={a.payment_status === 'completed' ? 'success' : 'warning'}>{a.payment_status}</Badge></div>)}
              </div>
            )}
            {tab === 'Audit' && (
              <div className="space-y-2">
                {canAudit && (
                  <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => navigate(`/audit/${selected.id}`)}>
                    Log Audit Finding
                  </Button>
                )}
                {audits.length === 0 ? <div className="text-sm text-slate-500">No audit entries</div> : audits.map((a) => <div key={a.id} className="border border-slate-200 rounded-lg p-3 text-sm"><div className="font-medium">{a.audit_type} • {a.severity}</div><div className="text-slate-600">{a.finding}</div></div>)}
                {docs.length > 0 && <div className="text-xs text-slate-400">{docs.length} documents linked</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add parcel modal */}
      <AddParcelModal
        open={showAdd}
        projectId={projectId ?? null}
        onClose={() => setShowAdd(false)}
        creating={createParcel.isPending}
        onCreate={(p) => {
          createParcel.mutate(p as Partial<Parcel>, {
            onSuccess: () => setShowAdd(false),
          });
        }}
      />

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
