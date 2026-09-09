import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Image as ImageIcon, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useAuditLogs, useUpdateAudit } from '../../hooks/useAudit';
import { useAuth } from '../../context/AuthContext';
import { getSignedUrl } from '../../lib/supabase/storage';
import { Badge } from '../ui/Badge';

const SEVERITY_COLOR: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

interface AuditLogProps {
  parcelId?: string;
}

// Resolves a private-bucket path (or legacy URL) to a short-lived signed URL
function EvidenceImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSignedUrl('audit-evidence', path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return <span className="text-slate-400">(preview unavailable)</span>;
  return <img src={url} alt="Evidence" className="max-h-32 rounded border mt-1" />;
}

export default function AuditLogView({ parcelId }: AuditLogProps) {
  const { data: audits = [], isLoading } = useAuditLogs(parcelId);
  const { profile } = useAuth();
  const updateAudit = useUpdateAudit();
  const canResolve = ['admin', 'auditor'].includes(profile?.role ?? '');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterResolved, setFilterResolved] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = audits.filter((a) => {
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterType !== 'all' && a.audit_type !== filterType) return false;
    if (filterResolved === 'resolved' && !a.resolved) return false;
    if (filterResolved === 'unresolved' && a.resolved) return false;
    return true;
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-slate-500">Loading audits…</div>;

  return (
    <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck size={16} /> Audit Trail
        </h3>
        <span className="text-xs text-slate-500">{filtered.length} of {audits.length}</span>
        <div className="ml-auto flex flex-wrap gap-1">
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="h-8 px-2 border border-slate-200 rounded-md text-xs bg-[#0c0c0c] cursor-pointer">
            <option value="all">All severity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-8 px-2 border border-slate-200 rounded-md text-xs bg-[#0c0c0c] cursor-pointer">
            <option value="all">All types</option>
            <option value="satellite">Satellite</option>
            <option value="field">Field</option>
            <option value="compliance">Compliance</option>
          </select>
          <select value={filterResolved} onChange={(e) => setFilterResolved(e.target.value)} className="h-8 px-2 border border-slate-200 rounded-md text-xs bg-[#0c0c0c] cursor-pointer">
            <option value="all">All</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">No audit entries</div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-auto">
          {filtered.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-lg p-3 hover:bg-white/[0.04] cursor-pointer" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
              <div className="flex items-start gap-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${SEVERITY_COLOR[a.severity] ?? 'bg-slate-100'}`}>{a.severity}</span>
                <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs">{a.audit_type}</span>
                <span className="ml-auto flex items-center gap-1 text-xs">
                  {a.resolved ? <Badge variant="success">Resolved</Badge> : <Badge variant="danger">Unresolved</Badge>}
                  {expanded === a.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>
              <div className="text-sm text-slate-900 mt-2 line-clamp-2">{a.finding}</div>
              <div className="text-xs text-slate-500 mt-1">{new Date(a.created_at).toLocaleString()} • {a.parcel_id ? `Parcel ${a.parcel_id.slice(0, 8)}` : 'Project-level'}</div>
              {expanded === a.id && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-xs text-slate-700 whitespace-pre-wrap">{a.finding}</div>
                  {a.image_url && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <ImageIcon size={14} /> Evidence: <span className="truncate font-mono">{a.image_url}</span>
                      <EvidenceImage path={a.image_url} />
                    </div>
                  )}
                  {!a.resolved && a.severity === 'critical' && (
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle size={12} /> Critical unresolved — needs immediate attention
                    </div>
                  )}
                  {canResolve && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateAudit.mutate({ id: a.id, resolved: !a.resolved, resolved_at: !a.resolved ? new Date().toISOString() : null } as never);
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-[#38bdf8] hover:underline cursor-pointer"
                    >
                      <CheckCircle2 size={14} /> {a.resolved ? 'Reopen finding' : 'Mark resolved'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
