import { Link } from 'react-router-dom';
import {
  ArrowRight, Bell, CheckCircle2, ExternalLink, FileCheck, FileText, Layers, LineChart, Lock,
  Map as MapIcon, MapPin, Radar, Scale, ShieldCheck, Truck, Factory, Building2, Train, Mail, Phone,
  Users, Clock, BarChart3, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserMenu from '../components/layout/UserMenu';
import { useParcels } from '../hooks/useParcels';
import { useCompensation } from '../hooks/useCompensation';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import satelliteImage from '../assets/satellite.webp';

const CONTACT = {
  email: 'hello@godijicodes.in',
  phone: '+91 98XXX XXXXX',
};

const NAV = [
  { label: 'Platform', href: '#platform' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Use Cases', href: '#usecases' },
  { label: 'Resources', href: '#resources' },
  { label: 'Pricing', href: '#pricing' },
];

const PLATFORM = [
  { icon: Layers, title: '12-Stage Acquisition Pipeline', desc: 'Every parcel tracked through the full RFCTLARR 2013 workflow — from SIA to possession — with stage-level ownership and clock-ins.' },
  { icon: MapIcon, title: 'GIS Parcel Intelligence', desc: 'Interactive map of khasra-level parcels with acquisition status, consent progress and award values on one canvas.' },
  { icon: Radar, title: 'Real-Time SLA Monitoring', desc: 'Statutory and internal deadlines monitored continuously. Breaches surface the moment they happen, not at the review meeting.' },
  { icon: FileText, title: 'Document Vault', desc: 'Notifications, awards, consents and court filings stored against the parcel record — retrievable in seconds.' },
  { icon: Scale, title: 'Compensation Ledger', desc: 'Award-to-disbursement tracking with running totals per project, officer and beneficiary.' },
  { icon: ShieldCheck, title: 'Court-Ready Audit Trail', desc: 'Immutable audit log across every stage change, approval and payment — evidence packs assembled on demand.' },
];

const STEPS = [
  { no: '01', title: 'Notify', desc: 'Social impact assessment and preliminary notification published with parcel maps attached.' },
  { no: '02', title: 'Survey', desc: 'Field teams record boundaries, ownership and structures against khasra records in real time.' },
  { no: '03', title: 'Award', desc: 'Valuation, consent tracking and award declaration compiled with full statutory traceability.' },
  { no: '04', title: 'Compensate', desc: 'Payments disbursed against the ledger with running reconciliation per beneficiary.' },
  { no: '05', title: 'Possess', desc: 'Handover certified, disputes logged, and the audit trail sealed for court readiness.' },
];

const SOLUTIONS = [
  { icon: Truck, title: 'Highway Authorities', desc: 'NH, state PWD and corridor SPVs running parallel land parcels across hundreds of kilometres.' },
  { icon: Factory, title: 'Industrial Parks', desc: 'Industrial area development authorities assembling large contiguous blocks from fragmented holdings.' },
  { icon: Building2, title: 'Smart Cities', desc: 'Urban development bodies coordinating acquisition across dense, multi-owner municipal parcels.' },
  { icon: Train, title: 'Railway Lines', desc: 'Dedicated freight and expansion corridors with strict statutory timelines per notification batch.' },
];

const USE_CASES = [
  { place: 'Sonipat, NH-44 Widening', parcels: '42 parcels', stage: 'Stage 6 — Award', note: '3 SLA breaches resolved within 48 hours of going live.', accent: 'text-[#00d294]' },
  { place: 'Rewari, WDFC Corridor', parcels: '214 parcels', stage: 'Stage 9 — Possession', note: 'Disbursement reconciliation closed 4 weeks ahead of schedule.', accent: 'text-[#38bdf8]' },
  { place: 'Kharkhoda, IMC Phase II', parcels: '168 parcels', stage: 'Stage 3 — Notification', note: 'Consent tracking raised response rates by a quarter.', accent: 'text-[#00d294]' },
];

const RESOURCES = [
  { icon: Scale, title: 'RFCTLARR Act 2013 Reference', desc: 'Stage-by-stage statutory requirements mapped to product workflow.', tag: 'Legal' },
  { icon: FileCheck, title: 'Acquisition SOP Playbook', desc: 'Operating procedures for field officers, collectors and auditors.', tag: 'Playbook' },
  { icon: LineChart, title: 'Rollout Guides', desc: 'Project onboarding, data migration and GIS layer setup walkthroughs.', tag: 'Docs' },
  { icon: Lock, title: 'Security & Compliance', desc: 'Access control, data residency and audit-log retention explained.', tag: 'Trust' },
];

const IMPACT = [
  { value: '60%', label: 'Faster stage completion', sub: 'Median time per acquisition stage across pilot projects.' },
  { value: '40%', label: 'Fewer disputes escalated', sub: 'Consent and hearing records complete before escalation.' },
  { value: '100%', label: 'Audit coverage', sub: 'Every stage change, approval and payment logged by default.' },
];

const PRICING = [
  {
    name: 'Starter', price: '₹49,999', period: '/month', annual: 'Billed annually at ₹5.4L/year', featured: false,
    features: ['Up to 3 projects', '500 parcels', '5 officer seats', 'Core 12-stage workflow', 'SLA monitoring', 'Standard reports'],
    cta: 'Start with Starter',
  },
  {
    name: 'Scale', price: '₹1,49,999', period: '/month', annual: 'Billed annually at ₹16.2L/year', featured: true,
    features: ['Unlimited projects', '10,000 parcels', '25 officer seats', 'Everything in Starter', 'GIS parcel layers', 'Custom report builder', 'Priority support'],
    cta: 'Scale up',
  },
  {
    name: 'Enterprise', price: 'Custom', period: '', annual: 'Annual agreements with central billing', featured: false,
    features: ['Unlimited everything', 'SSO & role federation', 'Dedicated success manager', 'On-premise option', 'Custom integrations', 'SLA-backed support'],
    cta: 'Talk to us',
  },
];

const DEMO_PARCEL = {
  parcel_number: '245/1',
  owner_name: 'Naresh Tomar',
  village: 'Village Balgarh, Tehsil Sonipat',
  status: 'surveyed',
  risk_score: 0.39,
  land_use: 'Agricultural',
  compensation: 44226921,
  disbursed: 45,
};

const AUTHORIZED_ROLES = new Set(['admin', 'field_officer', 'auditor']);

const RISK_COLORS = { Low: '#00d294', Medium: '#fbbf24', High: '#fb923c', Critical: '#f43f5e' } as const;
const DEMO_RISK_COUNTS = { Low: 1900000, Medium: 380000, High: 90000, Critical: 30000 } as const;

function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

const compactFmt = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
function compact(value: number) {
  return compactFmt.format(value);
}

function progressForStatus(status?: string) {
  return { identified: 20, notified: 42, surveyed: 67, acquired: 100, disputed: 32 }[status ?? ''] ?? 67;
}

function riskLabel(score: number) {
  if (score >= 0.8) return 'Critical Risk';
  if (score >= 0.6) return 'High Risk';
  if (score >= 0.3) return 'Medium Risk';
  return 'Low Risk';
}

function Hero({ user, role }: { user: boolean; role?: string }) {
  const canViewData = user && !!role && AUTHORIZED_ROLES.has(role);
  const { data: parcels = [] } = useParcels(null, undefined, canViewData);
  const { data: awards = [] } = useCompensation(undefined, canViewData);
  const liveParcel = parcels.find((parcel) => parcel.risk_score != null) ?? parcels[0];
  const parcel = liveParcel ?? (canViewData ? DEMO_PARCEL : null);
  const isDemo = !liveParcel;
  const progress = progressForStatus(parcel?.status);
  const riskScore = Math.round((parcel?.risk_score ?? DEMO_PARCEL.risk_score) * 100);
  const compensation = liveParcel
    ? awards.filter((award) => award.parcel_id === liveParcel.id).reduce((sum, award) => sum + Number(award.awarded_amount ?? 0), 0)
    : DEMO_PARCEL.compensation;
  const parcelCount = canViewData && parcels.length ? parcels.length : 2400000;
  const highRiskCount = canViewData && parcels.length
    ? parcels.filter((item) => (item.risk_score ?? 0) >= 0.6).length
    : 120000;
  const paidAmount = canViewData && awards.length
    ? awards.filter((award) => award.payment_status === 'completed').reduce((sum, award) => sum + Number(award.awarded_amount ?? 0), 0)
    : 12800000000;
  const riskLevelOf = (score?: number | null) => ((score ?? 0) > 0.8 ? 'Critical' : (score ?? 0) > 0.6 ? 'High' : (score ?? 0) > 0.3 ? 'Medium' : 'Low');
  const riskData = ['Low', 'Medium', 'High', 'Critical'].map((name) => ({
    name,
    color: RISK_COLORS[name as keyof typeof RISK_COLORS],
    count: canViewData && parcels.length
      ? parcels.filter((item) => riskLevelOf(item.risk_score) === name).length
      : DEMO_RISK_COUNTS[name as keyof typeof DEMO_RISK_COUNTS],
  }));

  return (
    <section
      className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-black bg-cover bg-center"
      style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.24) 58%, rgba(0,0,0,.62)), linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.18)), url(${satelliteImage})` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_35%,transparent_0,rgba(0,0,0,.28)_75%)]" />

      <div className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-[1500px] flex-col justify-between gap-8 px-4 py-5 sm:px-8 lg:px-10">
        <div className="flex items-stretch justify-between gap-4">
          <div className="flex items-center rounded-2xl border border-white/10 bg-black/75 px-4 text-xs text-white/60 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 font-mono tracking-[.16em]">
              <span className="live-dot" /> Real Time National Land Acquisition And Management System
            </div>
          </div>
          <div className="hidden items-stretch gap-1 rounded-2xl border border-white/10 bg-black/75 p-1 text-sm text-white/55 shadow-2xl backdrop-blur-xl sm:flex">
            <Link to="/dashboard" className="inline-flex items-center rounded-xl bg-white px-4 font-medium text-black">Satellite</Link>
            <Link to="/parcels" className="inline-flex items-center rounded-xl px-3 transition-colors hover:bg-white/10">Land parcels</Link>
            <Link to="/compensation" className="inline-flex items-center rounded-xl px-3 transition-colors hover:bg-white/10">Risk overlay</Link>
            <Link to={user ? '/dashboard' : '/login'} aria-label={user ? 'Open dashboard' : 'Login'} className="inline-flex items-center rounded-xl px-2 text-white/40 transition-colors hover:bg-white/10">↗</Link>
          </div>
        </div>

        <div className="grid flex-1 items-stretch gap-6 lg:grid-cols-[minmax(0,460px)_minmax(280px,370px)] lg:justify-between">
          <div className="max-w-[460px] rounded-[1.75rem] border border-white/10 bg-[#0b0d0b]/90 p-7 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="flex items-center gap-2 text-xs font-mono tracking-[.2em] text-white/55">
              <span className="text-white">✣</span> ENTERPRISE GIS PLATFORM
            </div>
            <h1 className="mt-7 font-display text-4xl font-bold leading-[.98] tracking-[-.04em] text-white sm:text-6xl">
              National Land Acquisition &amp; Management System
            </h1>
            <p className="mt-7 text-base leading-7 text-white/60 sm:text-lg">
              A unified geospatial platform for real-time land acquisition, ownership verification, legal tracking, compensation management, and AI-driven decision support.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-white/85 sm:text-base">
              {['Real-Time Parcel Intelligence', 'End-to-End Acquisition Workflow', 'Legal & Ownership Verification', 'Compensation & Disbursement', 'AI Risk & Impact Assessment'].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="shrink-0 text-white" /> {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? '/dashboard' : '/register'} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-black transition-colors hover:bg-neutral-200">
                Explore Platform <ArrowRight size={17} />
              </Link>
              <Link to={user ? '/dashboard' : '/login'} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-medium text-white transition-colors hover:bg-white/10">
                Login <ExternalLink size={16} />
              </Link>
            </div>
            <div className="mt-9 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div><strong className="block text-lg text-white sm:text-xl">{compact(parcelCount)}+</strong><span className="text-xs text-white/45">Parcels managed</span></div>
              <div><strong className="block text-lg text-white sm:text-xl">₹{compact(paidAmount)}</strong><span className="text-xs text-white/45">Compensation tracked</span></div>
              <div><strong className="block text-lg text-white sm:text-xl">{compact(highRiskCount)}</strong><span className="text-xs text-white/45">Risk flagged</span></div>
            </div>
          </div>

          {canViewData && parcel && (
            <div className="flex w-full max-w-[370px] flex-col gap-5 lg:justify-self-end">
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b0d0b]/95 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="font-semibold">Parcel Overview</h2>
                <button className="rounded-lg p-1 text-white/50 hover:bg-white/10" aria-label="Close parcel overview"><X size={18} /></button>
              </div>
              <div className="space-y-5 p-5">
                {isDemo && <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">Demo record until live parcel data is available.</div>}
                <div>
                  <div className="text-xs text-white/40">PARCEL ID: {parcel.parcel_number}</div>
                  <div className="mt-1 font-semibold">{parcel.owner_name}</div>
                  <div className="text-sm text-white/45">{liveParcel ? [liveParcel.village, liveParcel.district].filter(Boolean).join(', ') || 'Location recorded in parcel register' : DEMO_PARCEL.village}</div>
                </div>
                <div className="flex items-center justify-between text-sm"><span className="text-white/50">Legal Status</span><strong>{parcel.status === 'disputed' ? 'Review' : 'Clear'}</strong></div>
                <div>
                  <div className="mb-2 flex justify-between text-sm"><span className="text-white/50">Acquisition Status</span><strong>{progress}%</strong></div>
                  <div className="h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} /></div>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <div className="flex justify-between text-sm"><span className="text-white/50">Compensation (₹)</span><span className="text-xs text-white/40">Disbursed {liveParcel ? 'live' : `${DEMO_PARCEL.disbursed}%`}</span></div>
                  <div className="mt-1 text-xl font-bold">{formatCurrency(compensation || DEMO_PARCEL.compensation)}</div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 p-4">
                  <div><div className="text-xs uppercase tracking-wide text-white/40">AI Risk Score</div><div className="mt-1 font-medium">{riskLabel(riskScore / 100)}</div></div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-lg font-bold">{riskScore}</div>
                </div>
                <div className="flex justify-between gap-4 text-sm"><span className="text-white/50">Land Use <strong className="ml-2 text-white">{parcel.land_use ?? DEMO_PARCEL.land_use}</strong></span><span className="text-white/50">Zone Type <strong className="ml-2 text-white">Semi-Urban</strong></span></div>
                <Link to="/parcels" className="flex items-center justify-between rounded-xl border border-white/15 px-4 py-3 text-sm font-medium hover:bg-white/10">View Complete Record <ArrowRight size={16} /></Link>
              </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0b0d0b]/95 p-5 text-white shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold"><BarChart3 size={18} /> AI Risk Analysis</div>
                  <span className={`text-xs ${isDemo ? 'text-amber-200' : 'text-emerald-300'}`}>{isDemo ? 'Demo' : 'Live'}</span>
                </div>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-32 w-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={riskData} dataKey="count" nameKey="name" innerRadius={34} outerRadius={54}>
                          {riskData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0b0d0b', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex-1 space-y-1.5 text-xs text-white/60">
                    {riskData.map((entry) => (
                      <li key={entry.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />{entry.name}</span>
                        <strong className="text-white">{entry.count.toLocaleString('en-IN')}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { user, profile } = useAuth();

  return (
    <div className="bg-black text-[#ededed]">
      {/* Nav */}
      <header className="h-14 sticky top-0 z-40 bg-black/80 backdrop-blur border-b border-white/10 flex items-center justify-between px-6">
        <Link to="/" className="font-semibold tracking-tight">
          RTNLAMS
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#8f8f8f]">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-white transition-colors">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!user && (
            <Link to="/login" className="hidden rounded-md border border-white/15 px-3 py-1.5 text-sm transition-colors hover:bg-white/[0.04] sm:inline-flex">
              Login
            </Link>
          )}
          {user ? (
            <UserMenu />
          ) : (
            <Link to="/register" className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200">
              Get Started
            </Link>
          )}
        </div>
      </header>

      <Hero user={!!user} role={profile?.role} />

      {/* Platform */}
      <section id="platform" className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-xs text-[#00d294] mb-2">// PLATFORM</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Everything the acquisition office needs</h2>
          <p className="mt-3 text-[#8f8f8f] max-w-2xl">One system of record from first notification to final possession — built for the way RFCTLARR actually runs.</p>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORM.map((c) => (
              <div key={c.title} className="card card-hover rounded-xl p-6">
                <c.icon size={20} className="text-white mb-4" />
                <h3 className="font-medium">{c.title}</h3>
                <p className="mt-2 text-sm text-[#8f8f8f] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-xs text-[#00d294] mb-2">// WORKFLOW</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">The 12-stage pipeline, made visible</h2>
          <p className="mt-3 text-[#8f8f8f] max-w-2xl">Five commands cover the statutory arc — each one backed by parcel-level state, deadlines and evidence.</p>
          <div className="mt-12 grid md:grid-cols-5 gap-4">
            {STEPS.map((s) => (
              <div key={s.no} className="card rounded-xl p-5">
                <div className="font-mono text-xs text-[#8f8f8f] mb-3">{s.no}</div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-[#8f8f8f] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section id="solutions" className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-xs text-[#00d294] mb-2">// SOLUTIONS</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Built for every acquiring authority</h2>
          <div className="mt-12 grid md:grid-cols-2 gap-4">
            {SOLUTIONS.map((s) => (
              <div key={s.title} className="card card-hover rounded-xl p-6 flex gap-4">
                <s.icon size={22} className="text-white shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm text-[#8f8f8f] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="usecases" className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-xs text-[#00d294] mb-2">// USE CASES</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Live corridors</h2>
          <div className="mt-12 space-y-4">
            {USE_CASES.map((u) => (
              <div key={u.place} className="card card-hover rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                <div className="flex items-center gap-3 md:w-72 shrink-0">
                  <MapPin size={18} className="text-white" />
                  <span className="font-medium">{u.place}</span>
                </div>
                <div className="font-mono text-sm tabnum">{u.parcels}</div>
                <div className="text-sm text-[#8f8f8f] font-mono">{u.stage}</div>
                <div className={`text-sm md:ml-auto ${u.accent}`}>{u.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resources */}
      <section id="resources" className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-xs text-[#00d294] mb-2">// RESOURCES</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Knowledge for the field</h2>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {RESOURCES.map((r) => (
              <div key={r.title} className="card card-hover rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <r.icon size={20} className="text-white" />
                  <span className="font-mono text-[10px] text-[#8f8f8f] border border-white/15 rounded-full px-2 py-0.5">{r.tag}</span>
                </div>
                <h3 className="font-medium">{r.title}</h3>
                <p className="mt-2 text-sm text-[#8f8f8f] leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-xs text-[#00d294] mb-2">// IMPACT</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Measured, not promised</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-xl overflow-hidden">
            {IMPACT.map((i) => (
              <div key={i.label} className="bg-black p-8 text-center">
                <div className="font-display text-4xl font-bold tabnum">{i.value}</div>
                <div className="mt-2 font-medium">{i.label}</div>
                <div className="mt-2 text-sm text-[#8f8f8f]">{i.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Market scope */}
      <section className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-xl overflow-hidden">
          <div className="bg-black p-8">
            <div className="font-display text-4xl font-bold tabnum">₹111L Cr</div>
            <div className="mt-2 text-[#8f8f8f]">National Infrastructure Pipeline flowing through land acquisition</div>
          </div>
          <div className="bg-black p-8">
            <div className="font-display text-4xl font-bold tabnum">₹15,000 Cr</div>
            <div className="mt-2 text-[#8f8f8f]">Compensation disbursed annually that RTNLAMS can reconcile</div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-xs text-[#00d294] mb-2">// PRICING</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Plans per acquisition authority</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-4">
            {PRICING.map((p) => (
              <div
                key={p.name}
                className={`card rounded-xl p-6 flex flex-col ${p.featured ? 'border-white/30 relative' : ''}`}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-6 bg-white text-black text-[10px] font-mono px-2 py-0.5 rounded-full">MOST ADOPTED</span>
                )}
                <h3 className="font-medium">{p.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold tabnum">{p.price}</span>
                  <span className="text-sm text-[#8f8f8f]">{p.period}</span>
                </div>
                <div className="mt-1 text-xs text-[#8f8f8f] font-mono">{p.annual}</div>
                <ul className="mt-6 space-y-2.5 text-sm flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[#ededed]">
                      <FileCheck size={15} className="text-[#00d294] shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`mt-8 inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    p.featured ? 'bg-white text-black hover:bg-neutral-200' : 'border border-white/15 hover:bg-white/[0.04]'
                  }`}
                >
                  {p.cta} <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="grid-overlay border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center fade-up">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#8f8f8f] border border-white/15 rounded-full px-3 py-1 mb-6">
            <Bell size={12} /> READY WHEN YOU ARE
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Launch the Control Tower.</h2>
          <p className="mt-4 text-[#8f8f8f] max-w-xl mx-auto">
            Onboard your first project in a day. Every stage, parcel, rupee and deadline — visible in real time.
          </p>
          <Link to="/register" className="mt-8 inline-flex items-center gap-2 bg-white text-black font-medium px-8 py-3.5 rounded-md hover:bg-neutral-200 transition-colors">
            Launch the Control Tower <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black">
        <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="font-semibold tracking-tight">RTNLAMS</div>
            <p className="mt-2 text-[#8f8f8f]">Real-Time National Land Acquisition Management System. A Government of India initiative built by Team GodijiCodes.</p>
          </div>
          <div>
            <div className="font-medium mb-3">Navigate</div>
            <ul className="space-y-2 text-[#8f8f8f]">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="hover:text-white transition-colors">{n.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium mb-3">Contact</div>
            <ul className="space-y-2 text-[#8f8f8f]">
              <li className="flex items-center gap-2"><Mail size={14} /> {CONTACT.email}</li>
              <li className="flex items-center gap-2"><Phone size={14} /> {CONTACT.phone}</li>
              <li className="flex items-center gap-2"><Users size={14} /> Team GodijiCodes</li>
              <li className="flex items-center gap-2"><Clock size={14} /> © 2026 RTNLAMS</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-[#8f8f8f]">
          RTNLAMS — Real-Time Control Tower for Land Acquisition • Built by Team GodijiCodes
        </div>
      </footer>
    </div>
  );
}
