import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, MessageSquare, Search, HelpCircle } from 'lucide-react';
import { useQueries } from '../hooks/useQueries';
import { timeAgo } from '../lib/utils/helpers';
import { Badge } from '../components/ui/Badge';
import QueryDetailModal from '../components/queries/QueryDetailModal';
import { useAuth } from '../context/AuthContext';
import { isStaff } from '../lib/permissions';
import { QUERY_CATEGORIES, QUERY_STATUSES, queryStatusVariant, queryStatusLabel } from '../lib/queries';
import type { RaisedQuery } from '../lib/types';

export default function Queries() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const deepLinkId = searchParams.get('id');

  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: queries = [], isLoading } = useQueries(undefined, statusFilter);

  // Deep link from the notification bell (/queries?id=…). Adjusted during render
  // (React's documented pattern) so a bell click while already on this page opens
  // the new query — no effect, no cascading render.
  const [lastDeepLink, setLastDeepLink] = useState(deepLinkId);
  if (deepLinkId !== lastDeepLink) {
    setLastDeepLink(deepLinkId);
    if (deepLinkId) setSelectedId(deepLinkId);
  }

  const filteredQueries = useMemo(() => {
    return queries.filter((q) => {
      if (categoryFilter !== 'all' && q.category !== categoryFilter) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        q.subject.toLowerCase().includes(term) ||
        q.description.toLowerCase().includes(term) ||
        (q.citizen?.full_name && q.citizen.full_name.toLowerCase().includes(term)) ||
        (q.parcel?.parcel_number && q.parcel.parcel_number.toLowerCase().includes(term))
      );
    });
  }, [queries, categoryFilter, search]);

  const statusVariant = (status: RaisedQuery['status']) => queryStatusVariant(status);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Raised Queries</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isStaff(profile?.role)
              ? 'Inquiries and grievances submitted by affected citizens across all parcels.'
              : 'Your questions and issues submitted to the land acquisition authority.'}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search queries, citizen, parcel…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 border border-white/10 rounded-lg text-xs bg-[#0c0c0c] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#38bdf8]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 border border-white/10 rounded-lg text-xs bg-[#0c0c0c] text-white focus:outline-none focus:ring-2 focus:ring-[#38bdf8] cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {QUERY_STATUSES.map((s) => (
            <option key={s} value={s}>{queryStatusLabel(s)}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 border border-white/10 rounded-lg text-xs bg-[#0c0c0c] text-white focus:outline-none focus:ring-2 focus:ring-[#38bdf8] cursor-pointer"
        >
          <option value="all">All Categories</option>
          {QUERY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Query List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading queries…</div>
      ) : filteredQueries.length === 0 ? (
        <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-8 text-center space-y-2">
          <HelpCircle size={28} className="mx-auto text-slate-500" />
          <h3 className="text-sm font-medium text-white">No queries found</h3>
          <p className="text-xs text-slate-400">
            {search || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'There are no active queries at this time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredQueries.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedId(q.id)}
              className="w-full text-left bg-[#0c0c0c] border border-white/10 hover:border-white/30 rounded-xl p-4 flex items-start justify-between gap-4 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0 mt-0.5 group-hover:border-sky-500/40">
                  <MessageSquare size={16} className="text-sky-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-white group-hover:text-sky-400 transition-colors truncate">
                      {q.subject}
                    </span>
                    <Badge variant={statusVariant(q.status)}>
                      {queryStatusLabel(q.status)}
                    </Badge>
                    <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      {q.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {q.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                    <span>Raised by <strong className="text-slate-300 font-medium">{q.citizen?.full_name || 'Citizen'}</strong></span>
                    <span>•</span>
                    <span>Parcel: <strong className="text-slate-300 font-medium">{q.parcel?.parcel_number || q.parcel_id}</strong></span>
                    <span>•</span>
                    <span>{timeAgo(q.created_at)}</span>
                  </div>
                </div>
              </div>

              <ChevronRight size={16} className="text-slate-500 group-hover:text-white shrink-0 mt-2 transition-colors" />
            </button>
          ))}
        </div>
      )}

      <QueryDetailModal queryId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
