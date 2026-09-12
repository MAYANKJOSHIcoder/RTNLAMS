import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UserMenu() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 py-1 px-2 hover:bg-white/10 rounded-md cursor-pointer transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="w-8 h-8 bg-white/10 border border-white/15 rounded-full flex items-center justify-center text-xs font-semibold">
          {(profile?.full_name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium leading-none truncate max-w-32">{profile?.full_name ?? user?.email ?? 'Guest'}</div>
          {profile?.role && (
            <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 bg-white text-black rounded font-medium capitalize">{profile.role.replace('_', ' ')}</span>
          )}
        </div>
        <ChevronDown size={14} className={`hidden md:block transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-[#0c0c0c] border border-slate-200 rounded-lg shadow-lg py-1 text-slate-700 z-50" role="menu">
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-sm font-medium text-slate-900 truncate">{profile?.full_name ?? 'User'}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email ?? 'Not signed in'}</div>
          </div>
          <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/[0.04] cursor-pointer" role="menuitem">
            <User size={16} /> Open Dashboard
          </Link>
          <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/[0.04] cursor-pointer" role="menuitem">
            <Settings size={16} /> Settings
          </Link>
          <div className="border-t border-slate-100 my-1" />
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer text-left" role="menuitem">
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
