import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, FileText, Gavel, Wallet, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/parcels', label: 'Parcels', icon: Map },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/hearings', label: 'Hearings', icon: Gavel },
  { to: '/compensation', label: 'Compensation', icon: Wallet },
  { to: '/audit', label: 'Audit', icon: ShieldCheck },
];

const mockProjects = [
  { id: 'p1', name: 'Delhi-Mumbai Highway (NH-48)' },
  { id: 'p2', name: 'Mumbai-Ahmedabad Rail Corridor' },
  { id: 'p3', name: 'Dholera Industrial Estate' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onClose }: { collapsed?: boolean; onToggle?: () => void; mobileOpen?: boolean; onClose?: () => void }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = collapsed ?? internalCollapsed;
  const toggle = onToggle ?? (() => setInternalCollapsed(!isCollapsed));
  const { projectId, setProjectId } = useProject();

  const width = isCollapsed ? 'w-16' : 'w-64';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} aria-hidden />}

      <aside
        className={`${width} bg-white border-r border-slate-200 flex flex-col transition-all duration-200 shrink-0
          ${mobileOpen ? 'fixed inset-y-0 left-0 z-40 lg:static' : 'hidden lg:flex'} min-h-[calc(100vh-3.5rem)]`}
        aria-label="Main navigation"
      >
        {/* Project selector — PROMPT 21 polish */}
        <div className={`p-3 border-b border-slate-100 ${isCollapsed ? 'hidden' : 'block'}`}>
          <label htmlFor="project-select" className="block text-xs font-medium text-slate-500 mb-1">
            Project
          </label>
          <select
            id="project-select"
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className="w-full h-8 px-2 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0369A1] cursor-pointer"
          >
            <option value="">All Projects</option>
            {mockProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={toggle}
          className="hidden lg:flex items-center gap-2 p-3 hover:bg-slate-50 text-slate-600 cursor-pointer border-b border-slate-100 transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!isCollapsed && <span className="text-sm">Collapse</span>}
        </button>

        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer group ${
                  isActive
                    ? 'bg-[#0F172A] text-white shadow-sm'
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

        {/* Notification badge placeholder — per ui-ux-pro-max nav-badge guidance */}
        {!isCollapsed && (
          <div className="px-3 pb-2">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs">
              <div className="font-medium text-amber-900">SLA Breaches: 3</div>
              <div className="text-amber-700">Needs attention</div>
            </div>
          </div>
        )}

        <div className="p-3 text-xs text-slate-400 border-t border-slate-200 flex items-center justify-between">
          {!isCollapsed && <span>v0.1.0 • IGDTUW</span>}
          {isCollapsed && <span>v0.1</span>}
        </div>
      </aside>
    </>
  );
}
