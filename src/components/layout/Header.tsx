import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Clock, FileText, Gavel, Menu, MessageSquare, Wallet } from 'lucide-react';
import ServiceHealth from './ServiceHealth';
import UserMenu from './UserMenu';
import QueryModal from '../queries/QueryModal';
import { useAuth } from '../../context/AuthContext';
import { CITIZEN_EVENTS, FAKE_QUERIES, STAFF_EVENTS, type FakeEvent, type FakeQuery } from '../../lib/fakeQueries';
import { timeAgo } from '../../lib/utils/helpers';

const crumbs: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/parcels': 'Parcels',
  '/documents': 'Documents',
  '/hearings': 'Hearings',
  '/compensation': 'Compensation',
  '/audit': 'Audit',
  '/queries': 'Raised Queries',
};

const EVENT_ICONS: Record<FakeEvent['kind'], typeof Bell> = {
  document: FileText,
  query: MessageSquare,
  stage: Clock,
  payment: Wallet,
  hearing: Gavel,
};

export default function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const location = useLocation();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [query, setQuery] = useState<FakeQuery | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Notifications go to the person who needs them: staff see queries/parcels
  // happening on their pipeline, citizens only see updates on their own case.
  const events = profile?.role === 'citizen' ? CITIZEN_EVENTS : STAFF_EVENTS;
  const count = seen ? 0 : events.length;
  const current = crumbs[location.pathname] ?? '';

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleEvent = (ev: FakeEvent) => {
    setOpen(false);
    if (ev.queryId) setQuery(FAKE_QUERIES.find((q) => q.id === ev.queryId) ?? null);
  };

  return (
    <>
      <header className="h-14 bg-black text-white flex items-center justify-between px-4 border-b border-white/10 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          {onMenuToggle && (
            <button onClick={onMenuToggle} className="lg:hidden p-2 hover:bg-white/10 rounded-md cursor-pointer" aria-label="Toggle sidebar">
              <Menu size={18} />
            </button>
          )}
          <Link to="/" className="font-semibold tracking-tight text-sm md:text-base truncate">
            RTNLAMS
          </Link>
          {current && (
            <>
              <span className="text-slate-500 hidden sm:inline">/</span>
              <span className="text-sm text-slate-300 hidden sm:inline truncate">{current}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ServiceHealth />

          <div className="relative" ref={bellRef}>
            <button
              aria-label={`Notifications ${count} unread`}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => {
                setOpen(!open);
                setSeen(true);
              }}
              className="relative p-2 hover:bg-white/10 rounded-md cursor-pointer transition-colors"
            >
              <Bell size={18} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-black">
                  {count}
                </span>
              )}
            </button>

            {open && (
              <div
                className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-[#0c0c0c] border border-slate-200 rounded-lg shadow-lg py-1 z-50"
                role="menu"
                aria-label="Notifications"
              >
                <div className="px-3 py-2 border-b border-slate-100 text-sm font-medium text-slate-900">Notifications</div>
                {events.map((ev) => {
                  const Icon = EVENT_ICONS[ev.kind];
                  return (
                    <button
                      key={ev.id}
                      onClick={() => handleEvent(ev)}
                      role="menuitem"
                      className={`w-full text-left px-3 py-2.5 hover:bg-white/[0.04] flex items-start gap-2.5 ${ev.queryId ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <Icon size={14} className="mt-0.5 shrink-0 text-slate-500" />
                      <span className="min-w-0">
                        <span className="block text-xs text-slate-900">{ev.text}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          {timeAgo(ev.at)}
                          {ev.queryId ? ' · click to read' : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <UserMenu />
        </div>
      </header>

      <QueryModal query={query} onClose={() => setQuery(null)} />
    </>
  );
}
