import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import { useSlaBreaches } from '../../hooks/useStages';
import ServiceHealth from './ServiceHealth';
import UserMenu from './UserMenu';

const crumbs: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/parcels': 'Parcels',
  '/documents': 'Documents',
  '/hearings': 'Hearings',
  '/compensation': 'Compensation',
  '/audit': 'Audit',
};

export default function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: slaBreaches = [] } = useSlaBreaches();
  const notifCount = slaBreaches.length;
  const current = crumbs[location.pathname] ?? '';

  return (
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

        <button
          aria-label={`Notifications ${notifCount} unread`}
          onClick={() => notifCount > 0 && navigate('/dashboard')}
          className="relative p-2 hover:bg-white/10 rounded-md cursor-pointer transition-colors"
        >
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-black">
              {notifCount}
            </span>
          )}
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
