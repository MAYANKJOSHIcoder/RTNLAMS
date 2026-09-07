import { useState } from 'react';
import { useParams } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";
import DocumentUpload from "../components/documents/DocumentUpload";
import DocumentList from "../components/documents/DocumentList";
import DocumentDetail from "../components/documents/DocumentDetail";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import type { Document as DocType } from "../lib/types";

export default function Documents() {
  const { id: selectedId } = useParams();
  const { data: docs = [], isLoading, refetch, isError, error } = useDocuments(selectedId);
  const [viewDoc, setViewDoc] = useState<DocType | null>(null);

  const handleView = (doc: DocType) => setViewDoc(doc);

  return (
    <div className="p-6 space-y-4">
      {isError && <ErrorBanner message={`Documents failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      <h1 className="text-2xl font-semibold text-slate-900">
        Documents {selectedId ? `(Parcel: ${selectedId})` : "(All)"}
      </h1>

      {selectedId ? (
        <DocumentUpload parcelId={selectedId} onUploaded={() => refetch()} />
      ) : null}

      <DocumentList parcelId={selectedId} onView={handleView} />

      {viewDoc && (
        <DocumentDetail document={viewDoc} onClose={() => setViewDoc(null)} />
      )}

      {!selectedId && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">All Documents</h2>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No documents found. Select a parcel to upload documents.</div>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="border border-slate-200 rounded-lg p-3 text-sm flex justify-between items-center">
                  <div>
                    <span className="font-medium">{d.file_name ?? d.doc_type}</span>
                    <span className="ml-2 text-slate-500">Parcel: {d.parcel_id}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${d.status === "verified" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                    {d.status}
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
