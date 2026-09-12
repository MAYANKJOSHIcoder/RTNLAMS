import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../lib/types';

/**
 * Route-level role guard. Disallowed roles bounce to /dashboard.
 * The DB (RLS) remains the real guard — this prevents empty dead-end pages.
 */
export default function RoleGate({ allow, children }: { allow: UserRole[]; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (!profile || !allow.includes(profile.role)) {
    // preserve attempted location for staff who might log in later
    void location;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
