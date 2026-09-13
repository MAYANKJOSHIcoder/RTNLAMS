import { useMemo, useState } from 'react';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { FAKE_QUERIES, type FakeQuery } from '../lib/fakeQueries';
import { timeAgo } from '../lib/utils/helpers';
import { Badge } from '../components/ui/Badge';
import QueryModal from '../components/queries/QueryModal';

export default function Queries() {
  const [selected, setSelected] = useState<FakeQuery | null>(null);

  const byPerson = useMemo(() => {
    const groups = new Map<string, FakeQuery[]>();
    for (const q of FAKE_QUERIES) groups.set(q.name, [...(groups.get(q.name) ?? []), q]);
    return [...groups.entries()]
      .map(([name, queries]) => ({ name, queries: [...queries].sort((a, b) => b.raisedAt.localeCompare(a.raisedAt)) }))
      .sort((a, b) => b.queries[0].raisedAt.localeCompare(a.queries[0].raisedAt));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Raised Queries</h1>
        <p className="text-sm text-slate-500 mt-1">Queries posted by affected persons, grouped under each person. Click a query to read it. (Demo data)</p>
      </div>

      {byPerson.map(({ name, queries }) => (
        <div key={name} className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-900" aria-hidden>
              {name[0]}
            </div>
            <div className="text-sm font-medium text-slate-900 flex-1 min-w-0 truncate">{name}</div>
            <Badge variant="neutral">{queries.length} {queries.length === 1 ? 'query' : 'queries'}</Badge>
          </div>
          <div className="space-y-2">
            {queries.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelected(q)}
                className="w-full text-left flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-white/[0.04] cursor-pointer"
              >
                <MessageSquare size={14} className="shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-900 truncate">{q.id} — {q.text}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Parcel {q.parcelId} · raised {timeAgo(q.raisedAt)}</span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      ))}

      <QueryModal query={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
