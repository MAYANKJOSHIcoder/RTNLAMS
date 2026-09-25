import { describe, it, expect } from 'vitest';
import {
  QUERY_CATEGORIES,
  QUERY_STATUSES,
  queryStatusVariant,
  queryStatusLabel,
  notificationTarget,
  isActionable,
} from './queries';
import type { NotificationItem } from './types';

function notification(partial: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'n1',
    user_id: 'u1',
    type: 'query_created',
    title: 'Title',
    message: 'Message',
    entity_type: 'query',
    entity_id: null,
    parcel_id: null,
    query_id: null,
    is_read: false,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe('QUERY_CATEGORIES', () => {
  it('exposes the 7 spec categories in order', () => {
    expect(QUERY_CATEGORIES).toEqual([
      'Land Record',
      'Document',
      'Compensation',
      'Survey',
      'Acquisition',
      'Payment',
      'Other',
    ]);
  });
});

describe('QUERY_STATUSES', () => {
  it('is the 4-state lifecycle open → under_review → resolved (+reopened)', () => {
    expect(QUERY_STATUSES).toEqual(['open', 'under_review', 'resolved', 'reopened']);
  });
});

describe('queryStatusVariant', () => {
  it('maps each status to its badge variant', () => {
    expect(queryStatusVariant('open')).toBe('neutral');
    expect(queryStatusVariant('under_review')).toBe('warning');
    expect(queryStatusVariant('resolved')).toBe('success');
    expect(queryStatusVariant('reopened')).toBe('danger');
  });
});

describe('queryStatusLabel', () => {
  it('humanises snake_case statuses', () => {
    expect(queryStatusLabel('under_review')).toBe('Under Review');
    expect(queryStatusLabel('open')).toBe('Open');
    expect(queryStatusLabel('resolved')).toBe('Resolved');
    expect(queryStatusLabel('reopened')).toBe('Reopened');
  });
});

describe('isActionable', () => {
  it('is false only for resolved queries', () => {
    expect(isActionable('open')).toBe(true);
    expect(isActionable('under_review')).toBe(true);
    expect(isActionable('reopened')).toBe(true);
    expect(isActionable('resolved')).toBe(false);
  });
});

describe('notificationTarget', () => {
  it('prefers query_id → /queries?id=', () => {
    expect(notificationTarget(notification({ query_id: 'q-9' }))).toBe('/queries?id=q-9');
  });

  it('falls back to entity_type=query with entity_id', () => {
    expect(notificationTarget(notification({ query_id: null, entity_id: 'q-7' }))).toBe('/queries?id=q-7');
  });

  it('routes document/hearing/compensation to their detail pages', () => {
    expect(notificationTarget(notification({ entity_type: 'document', entity_id: 'd1', query_id: null }))).toBe('/documents/d1');
    expect(notificationTarget(notification({ entity_type: 'hearing', entity_id: 'h1', query_id: null }))).toBe('/hearings/h1');
    // /compensation/:id is singular in App.tsx routing
    expect(notificationTarget(notification({ entity_type: 'compensation', entity_id: 'c1', query_id: null }))).toBe('/compensation/c1');
  });

  it('routes parcel notifications to /parcels?parcel=', () => {
    expect(notificationTarget(notification({ entity_type: 'stage', query_id: null, parcel_id: 'p-1' }))).toBe('/parcels?parcel=p-1');
    expect(notificationTarget(notification({ entity_type: 'parcel', entity_id: 'p-2', query_id: null }))).toBe('/parcels?parcel=p-2');
  });

  it('returns null when there is nothing to open', () => {
    expect(notificationTarget(notification({ entity_type: 'system', entity_id: null, query_id: null, parcel_id: null }))).toBeNull();
  });

  it('query_id wins over parcel_id (query notifications carry both)', () => {
    expect(notificationTarget(notification({ query_id: 'q-1', parcel_id: 'p-1' }))).toBe('/queries?id=q-1');
  });
});
