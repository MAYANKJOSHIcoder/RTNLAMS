import { useParams } from "react-router-dom";
import { useAuditLogs } from "../hooks/useAudit";
import AuditForm from "../components/audit/AuditForm";
import AuditLog from "../components/audit/AuditLog";
import { ErrorBanner } from "../components/ui/ErrorBanner";

export default function Audit() {
  const { id: selectedId } = useParams();
  const { data: logs = [], isLoading, refetch, isError, error } = useAuditLogs(selectedId);

  return (
    <div className="p-6 space-y-4">
      {isError && <ErrorBanner message={`Audit logs failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      <h1 className="text-2xl font-semibold text-slate-900">
        Audit {selectedId ? `(Parcel: ${selectedId})` : "(All)"}
      </h1>

      {selectedId ? (
        <AuditForm parcelId={selectedId} onSuccess={() => refetch()} />
      ) : null}

      <AuditLog parcelId={selectedId} />

      {!selectedId && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">All Audit Logs</h2>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No audit logs found</div>
          ) : (
            <div className="space-y-2">
              {logs.map((a) => (
                <div key={a.id} className="border border-slate-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{a.audit_type} — {a.severity}</span>
                    <span className="text-slate-500">Parcel: {a.parcel_id ?? "N/A"}</span>
                  </div>
                  <div className="text-slate-600">{a.finding}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {a.resolved ? "Resolved" : "Unresolved"} • {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
