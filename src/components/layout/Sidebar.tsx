import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, FileText, Gavel, Wallet, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProject } from '../../context/ProjectContext';
import { useSlaBreaches } from '../../hooks/useStages';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'field_officer', 'auditor', 'citizen'] },
  { to: '/parcels', label: 'Parcels', icon: Map, roles: ['admin', 'field_officer', 'auditor', 'citizen'] },
  { to: '/documents', label: 'Documents', icon: FileText, roles: ['admin', 'field_officer', 'auditor'] },
  { to: '/hearings', label: 'Hearings', icon: Gavel, roles: ['admin', 'field_officer', 'auditor'] },
  { to: '/compensation', label: 'Compensation', icon: Wallet, roles: ['admin', 'field_officer', 'auditor'] },
  { to: '/audit', label: 'Audit', icon: ShieldCheck, roles: ['admin', 'auditor'] },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onClose }: { collapsed?: boolean; onToggle?: () => void; mobileOpen?: boolean; onClose?: () => void }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = collapsed ?? internalCollapsed;
  const toggle = onToggle ?? (() => setInternalCollapsed(!isCollapsed));
  const { projectId, setProjectId } = useProject();
  const { data: slaBreaches = [] } = useSlaBreaches();
  const { profile } = useAuth();
  const userRole = profile?.role ?? 'citizen';
  const isCitizen = userRole === 'citizen';

  const { data: projects = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['projects-list'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase.from('projects').select('id, name').order('name');
      if (error) return [];
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const width = isCollapsed ? 'w-16' : 'w-64';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} aria-hidden />}

      <aside
        className={`${width} bg-black border-r border-white/10 flex flex-col transition-all duration-200 shrink-0
          ${mobileOpen ? 'fixed inset-y-0 left-0 z-40 lg:static' : 'hidden lg:flex'} min-h-[calc(100vh-3.5rem)]`}
        aria-label="Main navigation"
      >
        {/* Project selector — staff only (citizens see their own parcels regardless of project) */}
        <div className={`p-3 border-b border-white/10 ${isCollapsed || isCitizen ? 'hidden' : 'block'}`}>
          <label htmlFor="project-select" className="block text-xs font-medium text-slate-500 mb-1">
            Project
          </label>
          <select
            id="project-select"
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className="w-full h-8 px-2 border border-slate-300 rounded-md text-xs bg-[#0c0c0c] focus:outline-none focus:ring-2 focus:ring-[#38bdf8] cursor-pointer"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={toggle}
          className="hidden lg:flex items-center gap-2 p-3 hover:bg-white/[0.04] text-slate-600 cursor-pointer border-b border-white/10 transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!isCollapsed && <span className="text-sm">Collapse</span>}
        </button>

        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {nav.filter(item => item.roles.includes(userRole)).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer group ${
                  isActive
                    ? 'bg-white text-black shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                } ${isCollapsed ? 'justify-center' : ''}`
              }
              title={isCollapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* SLA breach badge — staff only */}
        {!isCollapsed && !isCitizen && (
          <div className="px-3 pb-2">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs">
              <div className="font-medium text-amber-900">SLA Breaches: {slaBreaches.length}</div>
              <div className="text-amber-700">{slaBreaches.length > 0 ? "Needs attention" : "On track"}</div>
            </div>
          </div>
        )}

        <div className="p-3 text-xs text-slate-400 border-t border-white/10 flex items-center justify-between">
          {!isCollapsed && <span>v0.1.0</span>}
          {isCollapsed && <span>v0.1</span>}
        </div>
      </aside>
    </>
  );
}
