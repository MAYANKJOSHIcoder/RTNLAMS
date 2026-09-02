import { useState } from 'react';
import { FileText, Eye, Trash2 } from 'lucide-react';
import { useDocuments, useDeleteDocument } from '../../hooks/useDocuments';
import { Badge, statusToBadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import type { Document as DocType } from '../../lib/types';

interface DocumentListProps {
  parcelId: string;
  onView?: (doc: DocType) => void;
}

export default function DocumentList({ parcelId, onView }: DocumentListProps) {
  const { data: docs = [], isLoading } = useDocuments(parcelId);
  const del = useDeleteDocument();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const filtered = docs.filter((d) => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterType !== 'all' && d.doc_type !== filterType) return false;
    return true;
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-slate-500">Loading documents…</div>;
  if (!docs.length)
    return (
      <EmptyState
        icon={<FileText size={24} />}
        title="No documents yet"
        description="Upload a deed or survey map to start extraction."
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 px-2 border border-slate-200 rounded-md text-xs bg-white cursor-pointer"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="uploaded">Uploaded</option>
          <option value="processing">Processing</option>
          <option value="extracted">Extracted</option>
          <option value="verified">Verified</option>
          <option value="flagged">Flagged</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-8 px-2 border border-slate-200 rounded-md text-xs bg-white cursor-pointer"
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          <option value="deed">Deed</option>
          <option value="survey_map">Survey Map</option>
          <option value="handwritten_deed">Handwritten Deed</option>
        </select>
        <span className="text-xs text-slate-500 flex items-center">{filtered.length} of {docs.length} documents</span>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700">File</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Type</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Language</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    <span className="truncate max-w-40 font-medium text-slate-900">{d.file_name ?? d.doc_type}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600">{d.doc_type}</td>
                <td className="px-3 py-2">
                  <Badge variant={statusToBadgeVariant(d.status)}>{d.status}</Badge>
                </td>
                <td className="px-3 py-2 text-slate-600">{d.language ?? '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onView?.(d)} aria-label="View document">
                      <Eye size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => del.mutate({ id: d.id, parcelId })} aria-label="Delete document">
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
