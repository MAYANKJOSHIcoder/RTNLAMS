import { useParams } from "react-router-dom";
import { useCompensation, useCreateCompensation, useUpdateCompensation } from "../hooks/useCompensation";
import CompensationForm from "../components/compensation/CompensationForm";
import PaymentDashboard from "../components/compensation/PaymentDashboard";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import type { PaymentStatus } from "../lib/types";

export default function Compensation() {
  const { id: selectedId } = useParams();
  const { data: awards = [], isLoading, isError, error } = useCompensation(selectedId);
  const createAward = useCreateCompensation();
  const updateAward = useUpdateCompensation();
  const existingAward = awards[0] ?? null;

  return (
    <div className="p-6 space-y-4">
      {isError && <ErrorBanner message={`Compensation failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      <h1 className="text-2xl font-semibold text-slate-900">
        Compensation {selectedId ? `(Parcel: ${selectedId})` : "(All)"}
      </h1>

      {selectedId ? (
        <CompensationForm
          award={existingAward}
          onSave={(payload) => {
            const typed = { ...payload, payment_status: payload.payment_status as PaymentStatus };
            if (existingAward) {
              updateAward.mutate({ id: existingAward.id, ...typed });
            } else {
              createAward.mutate({ parcel_id: selectedId, ...typed });
            }
          }}
          saving={createAward.isPending || updateAward.isPending}
        />
      ) : null}

      <PaymentDashboard awards={awards ?? []} />

      {!selectedId && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">All Compensation Awards</h2>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : awards.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No compensation awards found</div>
          ) : (
            <div className="space-y-2">
              {awards.map((a) => (
                <div key={a.id} className="border border-slate-200 rounded-lg p-3 text-sm flex justify-between items-center">
                  <div>
                    <span className="font-medium">₹{Number(a.awarded_amount).toLocaleString("en-IN")}</span>
                    <span className="ml-2 text-slate-500">Parcel: {a.parcel_id}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${a.payment_status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {a.payment_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
