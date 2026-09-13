import Modal from '../ui/Modal';
import type { FakeQuery } from '../../lib/fakeQueries';

export default function QueryModal({ query, onClose }: { query: FakeQuery | null; onClose: () => void }) {
  return (
    <Modal open={!!query} onClose={onClose} title={query ? `Query ${query.id}` : ''}>
      {query && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Raised by</div>
              <div className="font-medium text-slate-900">{query.name}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Parcel ID</div>
              <div className="font-medium text-slate-900">{query.parcelId}</div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Raised on</div>
            <div className="text-slate-900">
              {new Date(query.raisedAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">What they said</div>
            <p className="border border-slate-200 rounded-lg p-3 text-slate-900 leading-relaxed">{query.text}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
