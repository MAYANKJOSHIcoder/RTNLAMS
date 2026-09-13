import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { config, isIndicTransConfigured, isSupabaseConfigured } from '../../lib/config';
import { supabase } from '../../lib/supabase/client';

type Status = 'ok' | 'down' | 'skipped' | 'checking';
interface Service {
  key: string;
  label: string;
  required?: boolean;
  check: () => Promise<Status>;
}

const TIMEOUT = 8000;

const services: Service[] = [
  {
    key: 'supabase',
    label: 'Supabase API',
    required: true,
    check: async () => {
      if (!isSupabaseConfigured()) return 'down';
      const { error } = await supabase.from('parcels').select('id', { count: 'exact', head: true });
      return error ? 'down' : 'ok';
    },
  },
  {
    key: 'auth',
    label: 'Auth + profile row',
    required: true,
    check: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return 'down';
      const { data, error } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).maybeSingle();
      if (error || !data) return 'down'; // missing profile = silently demoted to citizen
      return 'ok';
    },
  },
  {
    key: 'postgis',
    label: 'PostGIS RPCs + seed',
    check: async () => {
      const { error } = await supabase.rpc('parcels_within_bbox' as never, { min_lat: 28.4, min_lng: 76.9, max_lat: 28.8, max_lng: 77.3 } as never);
      if (error && /does not exist|function/i.test(error.message)) return 'down'; // 005 not applied
      return 'ok';
    },
  },
  {
    key: 'storage',
    label: 'Storage buckets (003)',
    check: async () => {
      // Authenticated client transport — proves bucket exists + RLS allows this session
      const { error } = await supabase.storage.from('documents').list('', { limit: 1 });
      if (!error) return 'ok';
      // 003 tightened storage to per-role policies — a citizen session is
      // expected to be denied list; that's 'skipped', not 'down'.
      if (/row-level security|authorization|not authorized|403/i.test(error.message)) return 'skipped';
      return 'down';
    },
  },
  {
    key: 'gemini',
    label: 'Gemini API (server proxy)',
    check: async () => {
      // /api/gemini GET — server holds the key, reports reachability only.
      // 15 s budget > server's internal 8 s Google timeout, so a cold TLS
      // handshake on the very first probe doesn't show a false 'down'.
      const res = await fetch('/api/gemini', { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return 'down';
      const json = (await res.json().catch(() => null)) as { gemini?: boolean } | null;
      return json?.gemini ? 'ok' : 'down';
    },
  },
  {
    key: 'indictrans',
    label: 'IndicTrans2 server',
    check: async () => {
      if (!isIndicTransConfigured()) return 'skipped';
      const res = await fetch(`${config.indicTransApiUrl}/health`, { signal: AbortSignal.timeout(TIMEOUT) });
      return res.ok ? 'ok' : 'down';
    },
  },
  {
    key: 'tesseract',
    label: 'Tesseract OCR engine',
    // Lazy-loaded with the first upload — no worker spawn / bundle download here
    check: async () => 'skipped',
  },
  {
    key: 'satellite',
    label: 'Satellite tiles (Esri)',
    check: async () => {
      const res = await fetch('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/8/5', { signal: AbortSignal.timeout(TIMEOUT) });
      return res.ok ? 'ok' : 'down';
    },
  },
];

const DOT: Record<Status, string> = {
  ok: 'bg-green-500',
  down: 'bg-red-500',
  skipped: 'bg-slate-400',
  checking: 'bg-amber-400 animate-pulse',
};

export default function ServiceHealth() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const runAll = useCallback(async () => {
    setStatuses(Object.fromEntries(services.map((s) => [s.key, 'checking' as Status])));
    await Promise.all(
      services.map(async (s) => {
        let st: Status = 'down';
        try {
          st = await s.check();
        } catch {
          st = 'down';
        }
        setStatuses((prev) => ({ ...prev, [s.key]: st }));
      }),
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    void runAll();
    const id = setInterval(() => void runAll(), 60_000);
    return () => clearInterval(id);
  }, [open, runAll]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const overall: Status = (() => {
    const vals = Object.values(statuses);
    if (!vals.length) return 'skipped';
    if (vals.some((v) => v === 'checking')) return 'checking';
    if (vals.some((v, i) => v === 'down' && services[i]?.required)) return 'down';
    if (vals.some((v) => v === 'down')) return 'skipped'; // yellow: optional down
    return 'ok';
  })();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`System status: ${overall}`}
        title="System status"
        className="p-2 hover:bg-white/10 rounded-md cursor-pointer transition-colors flex items-center gap-1.5"
      >
        <Activity size={16} className="text-slate-300" />
        <span className={`w-2.5 h-2.5 rounded-full ${DOT[overall]}`} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-[#0c0c0c] border border-slate-200 rounded-lg shadow-lg py-1 text-slate-700 z-50">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900">System Status</span>
            <button onClick={() => void runAll()} className="text-[10px] text-[#38bdf8] hover:underline cursor-pointer">Re-check</button>
          </div>
          {services.map((s) => (
            <div key={s.key} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[statuses[s.key] ?? 'checking']}`} aria-hidden />
              <span className="truncate">{s.label}</span>
              <span className="ml-auto text-slate-400">{statuses[s.key] === 'skipped' ? (s.key === 'tesseract' ? 'lazy' : 'no key') : statuses[s.key] ?? '…'}</span>
            </div>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100">Auto-refreshes every 60s</div>
        </div>
      )}
    </div>
  );
}
