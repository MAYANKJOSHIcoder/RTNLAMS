import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuditLogs, useUpdateAudit } from '../hooks/useAudit';
import { useParcels } from '../hooks/useParcels';
import AuditForm from '../components/audit/AuditForm';
import ParcelSelect from '../components/common/ParcelSelect';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';
import type { AuditLog, Parcel } from '../lib/types';

const SEVERITY_BADGE: Record<AuditLog['severity'], 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

export default function Audit() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [parcelId, setParcelId] = useState(routeId ?? '');
  const [severity, setSeverity] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('all');

  useEffect(() => {
    if (routeId) setParcelId(routeId);
  }, [routeId]);

  const { data: logs = [], isLoading, isError, error } = useAuditLogs(parcelId || undefined);
  const allQuery = useAuditLogs(undefined);
  const allLogs = allQuery.data ?? [];
  const updateAudit = useUpdateAudit();
  const { data: parcelsData = [] } = useParcels(null, undefined);
  const parcels = parcelsData as Parcel[];

  const parcelName = (id: string | null) => {
    if (!id) return 'Project-level';
    const p = parcels.find((x) => x.id === id);
    return p ? `${p.parcel_number} — ${p.owner_name}` : id.slice(0, 8);
  };

  const handleSelect = (id: string) => {
    setParcelId(id);
    navigate(id ? `/audit/${id}` : '/audit', { replace: true });
  };

  const list = parcelId ? logs : allLogs;
  const filtered = useMemo(() => {
    return list.filter((l) => {
      if (severity !== 'all' && l.severity !== severity) return false;
      if (resolvedFilter === 'resolved' && !l.resolved) return false;
      if (resolvedFilter === 'unresolved' && l.resolved) return false;
      return true;
    });
  }, [list, severity, resolvedFilter]);

  const canResolve = can(profile?.role, 'audit.resolve');

  return (
    <div className="p-6 space-y-4">
      {isError && <ErrorBanner message={`Audit logs failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      <h1 className="text-2xl font-semibold text-slate-900">Audit Trail</h1>

      <div className="flex flex-wrap gap-2 items-center">
        <ParcelSelect value={parcelId} onChange={handleSelect} />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-[#0c0c0c] cursor-pointer"
        >
          <option value="all">All severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value)}
          className="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-[#0c0c0c] cursor-pointer"
        >
          <option value="all">All states</option>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} findings</span>
      </div>

      {parcelId && can(profile?.role, 'audit.log') && (
        <AuditForm parcelId={parcelId} onSuccess={() => undefined} />
      )}

      <div className="space-y-2">
        {(parcelId ? isLoading : allQuery.isLoading) ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No audit findings match.</div>
        ) : (
          filtered.map((l) => (
            <div key={l.id} className="border border-slate-200 rounded-lg p-3 text-sm">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY_BADGE[l.severity]}>{l.severity}</Badge>
                  <span className="text-xs text-slate-500">{l.audit_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{new Date(l.created_at).toLocaleDateString()}</span>
                  {l.resolved ? (
                    <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 size={12} /> Resolved</span>
                  ) : canResolve ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={updateAudit.isPending && updateAudit.variables?.id === l.id}
                      onClick={() => updateAudit.mutate({ id: l.id, resolved: true, resolved_at: new Date().toISOString() })}
                    >
                      Resolve
                    </Button>
                  ) : (
                    <span className="text-xs text-amber-400">Unresolved</span>
                  )}
                </div>
              </div>
              <div className="text-slate-600 mt-1.5">{l.finding}</div>
              {!parcelId && (
                <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                  <ShieldCheck size={11} /> {parcelName(l.parcel_id)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
