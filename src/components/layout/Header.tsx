import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Settings, User, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const crumbs: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/parcels': 'Parcels',
  '/documents': 'Documents',
  '/hearings': 'Hearings',
  '/compensation': 'Compensation',
  '/audit': 'Audit',
};

export default function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { user, profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifCount] = useState(3); // placeholder until real notifications (PROMPT 19/20)
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const current = crumbs[location.pathname] ?? '';

  return (
    <header className="h-14 bg-[#0F172A] text-white flex items-center justify-between px-4 border-b border-slate-700 sticky top-0 z-40">
      <div className="flex items-center gap-3 min-w-0">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="lg:hidden p-2 hover:bg-slate-700 rounded-md cursor-pointer" aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
        )}
        <Link to="/dashboard" className="font-semibold tracking-tight text-sm md:text-base truncate">
          National Land Acquisition System
        </Link>
        {current && (
          <>
            <span className="text-slate-500 hidden sm:inline">/</span>
            <span className="text-sm text-slate-300 hidden sm:inline truncate">{current}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-label={`Notifications ${notifCount} unread`}
          className="relative p-2 hover:bg-slate-700 rounded-md cursor-pointer transition-colors"
        >
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0F172A]">
              {notifCount}
            </span>
          )}
        </button>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 py-1 px-2 hover:bg-slate-700 rounded-md cursor-pointer transition-colors"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-xs font-semibold">
              {(profile?.full_name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium leading-none truncate max-w-32">{profile?.full_name ?? user?.email ?? 'Guest'}</div>
              {profile?.role && (
                <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 bg-[#0369A1] rounded font-medium capitalize">{profile.role.replace('_', ' ')}</span>
              )}
            </div>
            <ChevronDown size={14} className={`hidden md:block transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-slate-700 z-50" role="menu">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="text-sm font-medium text-slate-900 truncate">{profile?.full_name ?? 'User'}</div>
                <div className="text-xs text-slate-500 truncate">{user?.email ?? 'Not signed in'}</div>
              </div>
              <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer" role="menuitem">
                <User size={16} /> Profile
              </Link>
              <button onClick={() => setOpen(false)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer text-left" role="menuitem">
                <Settings size={16} /> Settings
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer text-left" role="menuitem">
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
