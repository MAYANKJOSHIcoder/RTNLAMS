import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCompensation, useCreateCompensation, useUpdateCompensation, useSetPaymentStatus } from "../hooks/useCompensation";
import { useParcels } from "../hooks/useParcels";
import CompensationForm from "../components/compensation/CompensationForm";
import PaymentDashboard from "../components/compensation/PaymentDashboard";
import PaymentModal from "../components/compensation/PaymentModal";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/permissions";
import type { CompensationAward } from "../lib/types";

export default function Compensation() {
  const { id: selectedId } = useParams();
  const { profile } = useAuth();
  const { data: awards = [], isLoading, isError, error } = useCompensation(selectedId);
  const { data: parcels = [] } = useParcels();
  const createAward = useCreateCompensation();
  const updateAward = useUpdateCompensation();
  const setPayment = useSetPaymentStatus();
  const [payTarget, setPayTarget] = useState<CompensationAward | null>(null);
  const existingAward = awards[0] ?? null;
  const parcel = parcels.find((p) => p.id === selectedId);

  return (
    <div className="p-6 space-y-4">
      {isError && <ErrorBanner message={`Compensation failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      <h1 className="text-2xl font-semibold text-slate-900">
        Compensation {selectedId ? `(Parcel: ${selectedId})` : "(All)"}
      </h1>

      {selectedId && can(profile?.role, 'award.record') ? (
        <CompensationForm
          award={existingAward}
          parcel={parcel ? { area_hectares: parcel.area_hectares, land_use: parcel.land_use } : undefined}
          onSave={(payload) => {
            if (existingAward) {
              updateAward.mutate({ id: existingAward.id, ...payload });
            } else {
              createAward.mutate({ parcel_id: selectedId, ...payload });
            }
          }}
          saving={createAward.isPending || updateAward.isPending}
        />
      ) : null}

      <PaymentDashboard
        awards={awards ?? []}
        onAdvancePayment={can(profile?.role, 'payment.advance') ? (a) => {
          if (a.payment_status === 'pending') {
            // pending → initiated needs no UTR
            setPayment.mutate({ id: a.id, status: 'initiated' });
          } else {
            setPayTarget(a); // initiated → completed opens the UTR modal
          }
        } : undefined}
      />

      <PaymentModal
        award={payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={(utr) => {
          if (payTarget) {
            setPayment.mutate({ id: payTarget.id, status: 'completed', utr });
          }
          setPayTarget(null);
        }}
      />

      {!selectedId && (
        <div className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4">
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
