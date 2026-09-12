import { useState, useEffect, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import { useParcels } from '../hooks/useParcels';
import DocumentUpload from '../components/documents/DocumentUpload';
import DocumentList from '../components/documents/DocumentList';
import ParcelSelect from '../components/common/ParcelSelect';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';
import type { Document as DocType, Parcel } from '../lib/types';

// Detail pulls the gemini/OCR client — load it only when a doc is opened
const DocumentDetail = lazy(() => import('../components/documents/DocumentDetail'));

export default function Documents() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [parcelId, setParcelId] = useState(routeId ?? '');
  const [viewDoc, setViewDoc] = useState<DocType | null>(null);

  // route /documents/:id preselects the parcel
  useEffect(() => {
    if (routeId) setParcelId(routeId);
  }, [routeId]);

  const { refetch, isError, error } = useDocuments(parcelId || undefined);
  const allDocsQuery = useDocuments(undefined);
  const allDocs = allDocsQuery.data ?? [];

  // group "all" docs by parcel
  const byParcel: { parcel: string; docs: DocType[] }[] = (() => {
    const map = new Map<string, DocType[]>();
    allDocs.forEach((d) => {
      const list = map.get(d.parcel_id) ?? [];
      list.push(d);
      map.set(d.parcel_id, list);
    });
    return Array.from(map.entries()).map(([parcel, list]) => ({ parcel, docs: list }));
  })();

  const { data: parcelsData = [] } = useParcels(null, undefined);
  const parcels = parcelsData as Parcel[];
  const parcelName = (id: string) => {
    const p = parcels.find((x) => x.id === id);
    return p ? `${p.parcel_number} — ${p.owner_name}` : id.slice(0, 8);
  };

  const handleSelect = (id: string) => {
    setParcelId(id);
    navigate(id ? `/documents/${id}` : '/documents', { replace: true });
  };

  return (
    <div className="p-6 space-y-4">
      {isError && <ErrorBanner message={`Documents failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>

      <ParcelSelect value={parcelId} onChange={handleSelect} />

      {parcelId ? (
        <>
          {can(profile?.role, 'document.upload') && (
            <DocumentUpload parcelId={parcelId} onUploaded={() => refetch()} />
          )}
          <DocumentList parcelId={parcelId} onView={(d) => setViewDoc(d)} />
        </>
      ) : (
        <div className="space-y-3">
          {allDocsQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : byParcel.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No documents found. Select a parcel to upload documents.</div>
          ) : (
            byParcel.map(({ parcel, docs }) => (
              <div key={parcel} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] cursor-default">
                  <span className="text-sm font-medium text-slate-900">{parcelName(parcel)}</span>
                  <Badge variant="neutral">{docs.length} doc{docs.length === 1 ? '' : 's'}</Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {docs.map((d) => (
                    <DocRow key={d.id} doc={d} onView={() => setViewDoc(d)} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {viewDoc && (
        <Suspense fallback={<div className="py-8 text-center text-sm text-slate-500">Loading document…</div>}>
          <DocumentDetail document={viewDoc} onClose={() => setViewDoc(null)} />
        </Suspense>
      )}
    </div>
  );
}

function DocRow({ doc, onView }: { doc: DocType; onView: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.02]">
      <div className="min-w-0">
        <span className="font-medium truncate">{doc.file_name ?? doc.doc_type}</span>
        <span className="ml-2 text-slate-500">{doc.doc_type}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</span>
        <Badge variant={doc.status === 'verified' ? 'success' : doc.status === 'flagged' ? 'danger' : 'neutral'}>{doc.status}</Badge>
        <button onClick={onView} className="flex items-center gap-0.5 text-xs text-[#38bdf8] hover:underline cursor-pointer">
          View <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}
