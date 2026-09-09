import { Link } from 'react-router-dom';
import {
  ArrowRight, Bell, FileCheck, FileText, Layers, LineChart, Lock, Map as MapIcon,
  MapPin, Radar, Scale, ShieldCheck, Truck, Factory, Building2, Train, Mail, Phone, Users, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserMenu from '../components/layout/UserMenu';

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

const STATS = [
  { value: '₹4.9L Cr', label: 'Annual infrastructure outlay running through land acquisition' },
  { value: '60%', label: 'Of projects face delays at the acquisition stage' },
  { value: '30%', label: 'Typical cost overrun when acquisition slips' },
  { value: '1,800+', label: 'Land acquisition officers working without real-time tooling' },
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

export default function Landing() {
  const { user } = useAuth();

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
          {user ? (
            <UserMenu />
          ) : (
            <>
              <Link to="/login" className="text-sm px-3 py-1.5 rounded-md border border-white/15 hover:bg-white/[0.04] transition-colors">
                Login
              </Link>
              <Link to="/register" className="text-sm px-3 py-1.5 rounded-md bg-white text-black font-medium hover:bg-neutral-200 transition-colors">
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative grid-overlay border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center fade-up">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#8f8f8f] border border-white/15 rounded-full px-3 py-1 mb-6">
            <span className="live-dot" /> Real-Time Land Acquisition Control Tower
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            The control tower for
            <br />
            India's land acquisition.
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-base md:text-lg text-[#8f8f8f]">
            RTNLAMS tracks every parcel through the 12-stage RFCTLARR pipeline with real-time SLAs, GIS intelligence and court-ready audit trails — so acquisitions move at the speed of infrastructure.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 bg-white text-black font-medium px-6 py-3 rounded-md hover:bg-neutral-200 transition-colors">
              Launch the Control Tower <ArrowRight size={16} />
            </Link>
            <a href="#platform" className="inline-flex items-center gap-2 border border-white/15 px-6 py-3 rounded-md hover:bg-white/[0.04] transition-colors">
              See the platform
            </a>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-xl overflow-hidden text-left">
            {STATS.map((s) => (
              <div key={s.value} className="bg-black p-6">
                <div className="font-display text-2xl md:text-3xl font-bold tabnum">{s.value}</div>
                <div className="mt-2 text-xs text-[#8f8f8f] leading-relaxed">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
