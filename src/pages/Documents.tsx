import { useParams } from "react-router-dom";
import DocumentUpload from "../components/documents/DocumentUpload";
import DocumentList from "../components/documents/DocumentList";

export default function Documents() {
  const { id: selectedId } = useParams();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">
        Documents{" "}
        {selectedId ? `(Parcel ID: ${selectedId})` : ""}
      </h1>

      {selectedId ? (
        <>
          <DocumentList parcelId={selectedId} />
          <DocumentUpload parcelId={selectedId} />
        </>
      ) : null}
    </div>
  );
}
