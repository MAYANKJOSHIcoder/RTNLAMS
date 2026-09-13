// ponytail: demo-only data for the notification bell + Raised Queries page.
// Replace with a `queries` table + citizen posting flow when real.
export interface FakeQuery {
  id: string;
  name: string;
  parcelId: string;
  text: string;
  raisedAt: string; // ISO
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

export const FAKE_QUERIES: FakeQuery[] = [
  {
    id: 'Q-101',
    name: 'Ramesh Patil',
    parcelId: 'MH/KHK/P-0142',
    raisedAt: hoursAgo(3),
    text: 'The survey team visited my land under Section 4 without any prior notice. My khata number is 114/2 — please check whether the boundary was measured correctly, as the demarcation appears to cut into my farm courtyard.',
  },
  {
    id: 'Q-102',
    name: 'Sunita Devi',
    parcelId: 'UP/GZB/P-0087',
    raisedAt: hoursAgo(8),
    text: 'I signed the consent form but my 7/12 extract is missing from my record in the system. When will the award amount for my land be calculated?',
  },
  {
    id: 'Q-103',
    name: 'Abdul Karim Sheikh',
    parcelId: 'GJ/SRC/P-0023',
    raisedAt: hoursAgo(14),
    text: 'My land falls in the corridor but the preliminary notification shows the wrong village name (Maliyan instead of Maliya). How do I get this corrected before the award is passed?',
  },
  {
    id: 'Q-104',
    name: 'Ramesh Patil',
    parcelId: 'MH/KHK/P-0142',
    raisedAt: hoursAgo(27),
    text: 'Follow-up on my earlier query — no field officer has visited since the hearing date was changed. Requesting a reschedule as I will be away on agricultural duty.',
  },
  {
    id: 'Q-105',
    name: 'Lakhan Yadav',
    parcelId: 'MH/KHK/P-0156',
    raisedAt: hoursAgo(41),
    text: 'R&R package — my family has 6 members but only 4 are listed in the survey. How do I add my two elderly dependents for resettlement benefits?',
  },
];

const byId = (id: string) => FAKE_QUERIES.find((q) => q.id === id)!;

export interface FakeEvent {
  id: string;
  kind: 'document' | 'query' | 'stage' | 'payment' | 'hearing';
  text: string;
  at: string; // ISO
  queryId?: string;
}

// Staff feed: what happened on the parcels they must act on.
export const STAFF_EVENTS: FakeEvent[] = [
  { id: 'E-1', kind: 'query', text: `${byId('Q-101').name} raised a query on ${byId('Q-101').parcelId}`, at: byId('Q-101').raisedAt, queryId: 'Q-101' },
  { id: 'E-2', kind: 'document', text: 'New document attached — Consent Form for MH/KHK/P-0139', at: hoursAgo(5) },
  { id: 'E-3', kind: 'query', text: `${byId('Q-102').name} raised a query on ${byId('Q-102').parcelId}`, at: byId('Q-102').raisedAt, queryId: 'Q-102' },
  { id: 'E-4', kind: 'stage', text: 'Parcel MH/KHK/P-0142 moved to Stage 5 — Award Declaration', at: hoursAgo(10) },
  { id: 'E-5', kind: 'query', text: `${byId('Q-103').name} raised a query on ${byId('Q-103').parcelId}`, at: byId('Q-103').raisedAt, queryId: 'Q-103' },
];

// Citizen feed: own-case updates only.
export const CITIZEN_EVENTS: FakeEvent[] = [
  { id: 'C-1', kind: 'query', text: 'Your query on MH/KHK/P-0142 was received', at: byId('Q-101').raisedAt, queryId: 'Q-101' },
  { id: 'C-2', kind: 'document', text: 'New document attached — Survey Map for MH/KHK/P-0142', at: hoursAgo(12) },
  { id: 'C-3', kind: 'payment', text: 'Compensation processing started for MH/KHK/P-0142', at: hoursAgo(30) },
];
