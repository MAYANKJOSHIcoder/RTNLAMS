import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Footer from './components/layout/Footer';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingScreen } from './components/ui/LoadingScreen';
import RoleGate from './components/common/RoleGate';
import { useSessionTimeout } from './hooks/useSessionTimeout';

// Lazy pages — per ui-ux-pro-max performance guidance
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Parcels = lazy(() => import('./pages/Parcels'));
const Queries = lazy(() => import('./pages/Queries'));
const Documents = lazy(() => import('./pages/Documents'));
const Hearings = lazy(() => import('./pages/Hearings'));
const Compensation = lazy(() => import('./pages/Compensation'));
const Audit = lazy(() => import('./pages/Audit'));
const Settings = lazy(() => import('./pages/Settings'));

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  useSessionTimeout(!!user);
  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header onMenuToggle={() => setMobileOpen(!mobileOpen)} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
      <Footer />
    </div>
  );
}

const staff = ['admin', 'field_officer', 'auditor'] as const;

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ProjectProvider>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Public — no sidebar/header */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected — with layout */}
                <Route path="/dashboard" element={<Protected><AppLayout><Dashboard /></AppLayout></Protected>} />
                <Route path="/parcels" element={<Protected><AppLayout><Parcels /></AppLayout></Protected>} />
                <Route path="/queries" element={<Protected><RoleGate allow={[...staff]}><AppLayout><Queries /></AppLayout></RoleGate></Protected>} />
                <Route path="/documents" element={<Protected><RoleGate allow={[...staff]}><AppLayout><Documents /></AppLayout></RoleGate></Protected>} />
                <Route path="/documents/:id" element={<Protected><RoleGate allow={[...staff]}><AppLayout><Documents /></AppLayout></RoleGate></Protected>} />
                <Route path="/hearings" element={<Protected><RoleGate allow={[...staff]}><AppLayout><Hearings /></AppLayout></RoleGate></Protected>} />
                <Route path="/hearings/:id" element={<Protected><RoleGate allow={[...staff]}><AppLayout><Hearings /></AppLayout></RoleGate></Protected>} />
                <Route path="/compensation" element={<Protected><RoleGate allow={[...staff]}><AppLayout><Compensation /></AppLayout></RoleGate></Protected>} />
                <Route path="/compensation/:id" element={<Protected><RoleGate allow={[...staff]}><AppLayout><Compensation /></AppLayout></RoleGate></Protected>} />
                <Route path="/audit" element={<Protected><RoleGate allow={['admin', 'auditor']}><AppLayout><Audit /></AppLayout></RoleGate></Protected>} />
                <Route path="/audit/:id" element={<Protected><RoleGate allow={['admin', 'auditor']}><AppLayout><Audit /></AppLayout></RoleGate></Protected>} />
                <Route path="/settings" element={<Protected><AppLayout><Settings /></AppLayout></Protected>} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <Toaster
              position="top-right"
              toastOptions={{
                style: { background: '#0c0c0c', color: '#ededed', border: '1px solid #ffffff1a' },
              }}
            />
          </ProjectProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
