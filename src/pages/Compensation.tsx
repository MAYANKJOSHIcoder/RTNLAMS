import { useParams } from "react-router-dom";
import { useCompensation } from "../hooks/useCompensation";
import CompensationForm from "../components/compensation/CompensationForm";
import PaymentDashboard from "../components/compensation/PaymentDashboard";

export default function Compensation() {
  const { id: selectedId } = useParams();
  const { data: awards = [] } = useCompensation(selectedId);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">
        Compensation{" "}
        {selectedId ? `(Parcel ID: ${selectedId})` : ""}
      </h1>

      {selectedId ? (
        <>
          <CompensationForm award={awards?.[0] ?? null} onSave={() => {}} />
          <PaymentDashboard awards={awards ?? []} />
        </>
      ) : null}
    </div>
  );
}