/**
 * Client permission layer — single source of truth for UI gating.
 * The DB (RLS + RPC role checks) remains the real guard; this only hides UI.
 * Matrix mirrors supabase/001_schema.sql RLS exactly.
 */
import type { UserRole, UserProfile, Parcel, Document, Hearing, CompensationAward } from './types';

export type Action =
  | 'parcel.create'
  | 'parcel.csv'
  | 'parcel.edit'
  | 'parcel.delete'
  | 'stage.advance'
  | 'stage.resolveBreach'
  | 'document.upload'
  | 'document.edit'
  | 'hearing.schedule'
  | 'hearing.edit'
  | 'award.record'
  | 'award.edit'
  | 'payment.advance'
  | 'audit.log'
  | 'audit.resolve'
  | 'profile.edit';

const MATRIX: Record<Action, UserRole[]> = {
  'parcel.create': ['admin', 'field_officer'],
  'parcel.csv': ['admin', 'field_officer'],
  'parcel.edit': ['admin', 'field_officer'], // FO: own only — check with canEditParcel
  'parcel.delete': ['admin'],
  'stage.advance': ['admin', 'field_officer'],
  'stage.resolveBreach': ['admin', 'field_officer'],
  'document.upload': ['admin', 'field_officer'],
  'document.edit': ['admin', 'field_officer'], // FO: own only — canEditDocument
  'hearing.schedule': ['admin', 'field_officer'],
  'hearing.edit': ['admin', 'field_officer'], // FO: own only — canEditHearing
  'award.record': ['admin', 'field_officer'],
  'award.edit': ['admin', 'field_officer'], // FO: own only — canEditAward
  'payment.advance': ['admin', 'field_officer'],
  'audit.log': ['admin', 'auditor'],
  'audit.resolve': ['admin', 'auditor'],
  'profile.edit': ['admin', 'field_officer', 'auditor', 'citizen'],
};

export function can(role: UserRole | null | undefined, action: Action): boolean {
  if (!role) return false;
  return MATRIX[action].includes(role);
}

// Own-only helpers: FO may edit rows they created; admin bypasses.
export function canEditParcel(profile: UserProfile | null, parcel: Parcel): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  return profile.role === 'field_officer' && (parcel as unknown as { created_by?: string | null }).created_by === profile.id;
}

export function canEditDocument(profile: UserProfile | null, doc: Document): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  return profile.role === 'field_officer' && doc.uploaded_by === profile.id;
}

export function canEditHearing(profile: UserProfile | null, hearing: Hearing): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  return profile.role === 'field_officer' && hearing.created_by === profile.id;
}

export function canEditAward(profile: UserProfile | null, award: CompensationAward): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  return profile.role === 'field_officer' && (award as unknown as { created_by?: string | null }).created_by === profile.id;
}

// Convenience: is this a staff role that sees the full dataset?
export function isStaff(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'field_officer' || role === 'auditor';
}
