import { useParams } from "react-router-dom";
import { useCompensation } from "../hooks/useCompensation";
import CompensationForm from "../components/compensation/CompensationForm";
import PaymentDashboard from "../components/compensation/PaymentDashboard";

export default function Compensation() {
  const { id: selectedId } = useParams();
  const { data: awards = [], isLoading } = useCompensation(selectedId);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">
        Compensation {selectedId ? `(Parcel: ${selectedId})` : "(All)"}
      </h1>

      {selectedId ? (
        <CompensationForm award={awards?.[0] ?? null} onSave={() => {}} />
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
