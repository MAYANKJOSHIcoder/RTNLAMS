/**
 * Queries & Notifications domain helpers — pure functions shared by the
 * Raised Queries pages, the query detail modal, and the Header bell.
 * Keeping the routing/status mapping here makes it unit-testable without
 * mounting React or hitting Supabase.
 */
import type { QueryCategory, QueryStatus, NotificationItem } from './types';

export const QUERY_CATEGORIES: QueryCategory[] = [
  'Land Record',
  'Document',
  'Compensation',
  'Survey',
  'Acquisition',
  'Payment',
  'Other',
];

export const QUERY_STATUSES: QueryStatus[] = ['open', 'under_review', 'resolved', 'reopened'];

export type QueryBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

/** Status → Badge variant. open = neutral, under_review = warning, resolved = success, reopened = danger. */
export function queryStatusVariant(status: QueryStatus): QueryBadgeVariant {
  switch (status) {
    case 'resolved':
      return 'success';
    case 'under_review':
      return 'warning';
    case 'reopened':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Human-readable status label ('under_review' → 'Under Review'). */
export function queryStatusLabel(status: QueryStatus): string {
  return status
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** Detail page for entity types that have a `/:id` route (note: /compensation is singular). */
const DETAIL_ROUTE: Record<string, string> = {
  document: '/documents',
  hearing: '/hearings',
  compensation: '/compensation',
};

/**
 * Deep-link target for a notification. Query/parcel links carry a search param
 * so the destination page can auto-open the right record.
 * Returns null when the notification carries nothing to open.
 */
export function notificationTarget(n: Pick<NotificationItem, 'entity_type' | 'entity_id' | 'parcel_id' | 'query_id'>): string | null {
  if (n.query_id) return `/queries?id=${n.query_id}`;
  if (n.entity_type === 'query' && n.entity_id) return `/queries?id=${n.entity_id}`;
  if (n.entity_id && DETAIL_ROUTE[n.entity_type]) return `${DETAIL_ROUTE[n.entity_type]}/${n.entity_id}`;
  if (n.parcel_id) return `/parcels?parcel=${n.parcel_id}`;
  if (n.entity_type === 'parcel' && n.entity_id) return `/parcels?parcel=${n.entity_id}`;
  return null;
}

/** Statuses staff can still act on (not yet resolved). */
export function isActionable(status: QueryStatus): boolean {
  return status !== 'resolved';
}
