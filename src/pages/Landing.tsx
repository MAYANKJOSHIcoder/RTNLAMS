import { Link } from 'react-router-dom';
import { Map, FileText, ShieldCheck, ArrowRight, CheckCircle } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="h-14 bg-[#0F172A] text-white flex items-center justify-between px-6 sticky top-0 z-20">
        <span className="font-bold tracking-tight">National Land Acquisition System</span>
        <div className="flex gap-3">
          <Link to="/login" className="px-4 py-1.5 bg-white text-slate-900 rounded-md text-sm font-medium hover:bg-slate-100 transition-colors">Login</Link>
          <Link to="/register" className="px-4 py-1.5 bg-[#0369A1] text-white rounded-md text-sm font-medium hover:bg-[#0284c7] transition-colors">Register</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#0F172A] text-white px-6 py-16 md:py-20">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs mb-4">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" aria-hidden /> Live Control Tower • IGDTUW
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">Real-Time National Land Acquisition & Management System</h1>
          <p className="text-slate-300 mt-4 max-w-2xl mx-auto text-sm md:text-base">
            Integrated digital control tower uniting GIS parcel mapping, automated statutory workflows, and Indic document intelligence — document to parcel to decision.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link to="/login" className="px-6 py-2.5 bg-white text-slate-900 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 transition-colors">
              Get Started <ArrowRight size={16} />
            </Link>
            <Link to="/register" className="px-6 py-2.5 border border-white/30 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
              Create Account
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 justify-center mt-6 text-xs text-slate-400">
            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-400" /> 45% faster cycle</span>
            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-400" /> 95% Indic OCR</span>
            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-400" /> 100% SLA tracking</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-12 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="w-10 h-10 bg-blue-100 text-[#0369A1] rounded-lg flex items-center justify-center mb-3">
              <Map size={20} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">GIS Mapping</h3>
            <p className="text-xs text-slate-600 mt-1">Sub-meter cadastral boundaries overlaid with project corridor, PostGIS spatial queries, MapLibre + OSM.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-3">
              <FileText size={20} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">AI Document Processing</h3>
            <p className="text-xs text-slate-600 mt-1">Tesseract + IndicTrans → Gemini 2.0 Flash: deeds & survey maps → structured JSON 95% accurate.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-3">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Risk Analytics</h3>
            <p className="text-xs text-slate-600 mt-1">7-factor weighted delay prediction (ownership 25%, litigation 20%…) with donut, trend, top-10 alerts.</p>
          </div>
        </div>
      </section>

      {/* Statistics bar */}
      <section className="bg-white border-y border-slate-200 px-6 py-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-900">1,800+</div>
            <div className="text-xs text-slate-500">National projects tracked</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">60% ↓</div>
            <div className="text-xs text-slate-500">Manual processing reduced</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">30 days</div>
            <div className="text-xs text-slate-500">Avg SLA • compensation cycle</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">15,000 Cr</div>
            <div className="text-xs text-slate-500">Est. annual efficiency unlocked</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] text-slate-400 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 justify-between text-xs">
          <div>
            <div className="font-semibold text-white">IGDTUW • Team GodijiCodes</div>
            <div className="mt-1">Dept. of Infrastructure • Real-Time Control Tower</div>
            <div>© 2026 National Land Acquisition System</div>
          </div>
          <div className="text-slate-500 max-w-md">
            Built with Vite + Supabase + MapLibre + Gemini. Data sources: OpenStreetMap, Planet Basemaps. This is an academic MVP — not a government production system.
          </div>
        </div>
      </footer>
    </div>
  );
}
