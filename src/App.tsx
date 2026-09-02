import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Footer from './components/layout/Footer';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { useSessionTimeout } from './hooks/useSessionTimeout';

// Lazy pages — per ui-ux-pro-max performance guidance
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Parcels = lazy(() => import('./pages/Parcels'));
const Documents = lazy(() => import('./pages/Documents'));
const Hearings = lazy(() => import('./pages/Hearings'));
const Compensation = lazy(() => import('./pages/Compensation'));
const Audit = lazy(() => import('./pages/Audit'));

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  useSessionTimeout(!!user);
  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
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

                {/* Protected — with layout per PROMPT 7:186 */}
                <Route path="/dashboard" element={<Protected><AppLayout><Dashboard /></AppLayout></Protected>} />
                <Route path="/parcels" element={<Protected><AppLayout><Parcels /></AppLayout></Protected>} />
                <Route path="/documents" element={<Protected><AppLayout><Documents /></AppLayout></Protected>} />
                <Route path="/hearings" element={<Protected><AppLayout><Hearings /></AppLayout></Protected>} />
                <Route path="/compensation" element={<Protected><AppLayout><Compensation /></AppLayout></Protected>} />
                <Route path="/audit" element={<Protected><AppLayout><Audit /></AppLayout></Protected>} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <Toaster position="top-right" />
          </ProjectProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
