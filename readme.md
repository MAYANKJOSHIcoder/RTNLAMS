# Real-Time National Land Acquisition & Management System (RTNLAMS)

**Team:** GodijiCodes • IGDTUW  
**Spec:** 25-Prompt Vibe Coding Build (`PROMPTS_indictrans.md`) — MVP Control Tower for national infrastructure land acquisition

An integrated digital control tower uniting **GIS parcel mapping**, **automated statutory workflows**, and **Indic document intelligence** — document → parcel → decision.

---

## ⚡ Quick Status

| Component | Status |
|-----------|--------|
| Core App (UI, Auth, Routing, Layout) | ✅ Complete |
| Database Schema + RLS + PostGIS | ✅ Complete (001_schema.sql — apply to a fresh project) |
| GIS Mapping (MapLibre + OSM) | ✅ Complete |
| 12-Stage Lifecycle + SLA Tracking | ✅ Complete |
| Risk Scoring (7-factor) | ✅ Complete |
| Compensation + Hearings + Audit | ✅ Complete |
| Dashboard Control Tower | ✅ Complete |
| Parcels Hub (Search, Map, Tabs, CSV) | ✅ Complete |
| **Gemini OCR / IndicTrans Translation** | ✅ **Real** — tesseract.js + IndicTrans2 server + Gemini (keys set) |
| **Satellite Tiles** | ✅ **Real** — Esri World Imagery (free, no key) |
| **Spatial RPCs / Storage Buckets** | 🚧 **Migrations created** — need applying in Supabase |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | **Vite + React 19 + TypeScript** |
| Styling | **Tailwind CSS v4** + `@tailwindcss/vite` + `@theme` (institutional blue) |
| Components | **shadcn/ui patterns** (10 primitives) + `lucide-react` |
| Maps | **MapLibre GL JS** + **OpenStreetMap** tiles |
| Backend | **Supabase** (PostgreSQL + PostGIS + Auth + Storage) |
| AI / OCR | **Google Gemini 2.0 Flash** + **Tesseract.js** + **IndicTrans2** (Python FastAPI) |
| Satellite | **Esri World Imagery** (free, no key; replaces Sentinel Hub claim) |
| State | **@tanstack/react-query** |
| Validation | **zod** + **react-hook-form** |
| Charts | **Recharts** |
| Deploy | **Vercel** |

---

## Setup

```bash
# 1. Clone & install
cd RTNLAMS
npm install

# 2. Env — copy placeholders and fill
cp .env.example .env
# Edit .env with real keys (see Environment Variables below)

# 3. Supabase — create a FRESH project (or reset an existing one), SQL Editor (in order):
#   supabase/000_drop_all.sql   (existing project only — drops tables/functions/policies;
#                                then empty+delete the 3 buckets in Dashboard → Storage)
#   supabase/001_schema.sql     (complete schema: tables, RLS role matrix, stage RPCs,
#                                triggers, storage buckets, spatial RPCs, aadhaar)
#   supabase/002_seed.sql       (3 projects, 30 parcels spread across stages 2-11,
#                                docs, hearings, awards, audits, risks)
#   supabase/003_rls_hardening.sql   (per-bucket storage policies + invoker-rights RPCs)
#   supabase/004_corridor_width.sql  (corridor matching as an area, not a zero-width line)
#   supabase/005_queries_notifications.sql  (raised queries + threaded messages +
#                                per-user notifications, with RLS & real-event triggers)

# 4. Register 4 accounts via the app (any emails), then assign staff roles:
#   node scripts/set-role.mjs <email> admin
#   node scripts/set-role.mjs <email> field_officer
#   node scripts/set-role.mjs <email> auditor
#   (citizen is the default role; set-role.mjs also takes an optional 12-digit aadhaar)

# 5. Start IndicTrans2 server (for real translation):
cd indictrans-server
./start.sh          # Linux/macOS (or start.bat on Windows)
# First run only: python download_models.py (accept HF license first)
# Model direction: the client asks for tgt_lang="en", so start.sh/start.bat
# default INDIC_MODEL to ai4bharat/indictrans2-indic-en-dist-200M.
# Without this server, Gemini translates alone — the OCR Review modal records
# which engine produced each channel (ocr_extracted_data.pipeline).

# 6. Dev
npm run dev      # http://localhost:5173 (Vite ready ~500ms)
npm run build    # tsc -b && vite build → dist/
npm run preview  # preview production build
```

---

## Environment Variables

Client values use `import.meta.env.VITE_*` (validated independently in `src/lib/config.ts`).
**Server-only secrets carry no `VITE_` prefix** — Vite inlines every `VITE_*` value into the
public JS bundle at build time, so Vercel refuses to store a `VITE_`-prefixed name as a Secret
("Remove the public framework prefix…"). See `.env.example` for the split.

| Key | Exposure | Required | Purpose | Where to Get |
|-----|----------|----------|---------|--------------|
| `VITE_SUPABASE_URL` | Public (bundle) | **Yes** | Supabase project | Supabase Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Public (bundle) | **Yes** | Supabase anon key — RLS is the security boundary | Supabase Settings → API |
| `VITE_INDICTRAN_API_URL` | Public (bundle) | For translation | IndicTrans2 server (Indic → English, `tgt_lang="en"`) | `http://localhost:8080` (local) or remote URL |
| `GEMINI_API_KEY` | **Server-only** — Vercel **Secret** | For live OCR | Gemini key, read per-request by `api/gemini.ts` | https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | **Server-only** — Vercel **Secret** (optional) | — | Model id; defaults to `gemini-3.1-flash-lite` in `api/gemini.ts` | — |

**Missing keys → app runs in mock mode** (Delhi mock parcels, mock Gemini JSON, no satellite tiles).  
Config validators are independent — one missing key doesn't break others.

---

## Architecture

```
[ Landing (/) ] → [ Login/Register ] → AuthContext (Supabase Auth)
                                      ↓
                        Protected Routes → AppLayout (Header + Sidebar + Footer)
                                      ↓
    ┌──────────────┬──────────────┬──────────────┬──────────────┐
    │  Dashboard   │   Parcels    │  Documents   │  Hearings    │
    │  /dashboard  │  /parcels    │  /documents  │  /hearings   │
    │  KPI 5 + Map │ Table+Map    │ Upload+OCR   │ Form+Calndr  │
    │  60/40 Pipe  │ 6 tabs       │  View modal  │              │
    └──────────────┴──────────────┴──────────────┴──────────────┘
                               ↓
    Compensation (/compensation) — circleRate×area×multipliers → SLA 30d → Pie+Gauge
    Audit (/audit) — satellite/field/compliance → severity timeline

Lib: supabase/client (typed), queries (PostGIS ST_*), stages (12, SLA), risk (7-factor),
     compensation, gemini/client (15/min), config
DB:  9 tables (user_profiles, projects, parcels Geometry, documents JSONB, acquisition_stages 1-12,
      hearings JSONB attendees, compensation_awards, audit_logs, risk_assessments) + RLS + triggers
Storage: documents, audit-evidence, hearing-minutes buckets
Seed: 3 projects, 30 parcels (Delhi/Mumbai), 60 docs, 60 stages, 10 hearings, 15 awards, 20 audits, 30 risks
```

---

## Features

- **GIS Parcel Intelligence:** MapLibre + OSM, parcels colored by status, hover highlight, click popup, `MapControls` search/status filter/zoom/legend, bbox + PostGIS `ST_Within/DWithin/Intersects` via `queries.ts`.
- **Indic Document AI:** Drag-drop 10MB `DocumentUpload` → Supabase Storage → `DocumentList` status badges → **View modal** (OCR fields, confidence, translated text, raw text, download) → Gemini hybrid Tesseract+IndicTrans+Gemini prompts.
- **12-Stage Lifecycle:** `STAGES` 1→12, SLA 15/30 days, `StageTimeline` horizontal progress, `StageBoard` Kanban drag (validation `canAdvance` no-skip), `useAdvanceStage` with confirmation modal.
- **Dynamic Risk Scoring:** 7-factor weighted (ownership 0.25 … encroachment 0.05) → `RiskWidget` donut + top10 + trend, auto-reassess on doc/stage/audit events.
- **Compensation Tracker:** `circleRate × area(sqm) × landUse × market` + manual override + SLA 30d breach, `PaymentDashboard` Pie + gauge + history.
- **Hearings & Audit:** `HearingForm`/`Calendar` (objection/valuation/final/public, attendees JSONB) + `AuditForm`/`AuditLog` (satellite/field/compliance, severity, **real Storage upload** for evidence/minutes).
- **Dashboard Control Tower:** 5 KPIs (Projects/In-Progress/Breaches/High-Risk/Paid), Map 60% + Pipeline 40% (BarChart), Activity + RiskAlerts, 30s auto-refresh.
- **Parcels Hub:** Search (debounce 300ms) + status/risk/project filters, sortable paginated Table (8/pg), Map+highlight, 6 tabs (Overview/Documents/Timeline/Hearings/Compensation/Audit), Add Modal + CSV bulk upload.
- **Auth & Layout:** `AuthContext` session/login/logout/register + `user_profiles` role (admin/field_officer/auditor/citizen), `Protected → /login`, `Header` bell+role badge+dropdown, `Sidebar` collapsible+project selector, `Footer` IGDTUW.
- **Resilience:** `ErrorBoundary` (friendly + Try Again), `LoadingScreen` + `TableSkeleton`, `try/catch→toast` on all Supabase/Gemini, `zod` pre-DB, `sanitizeString`, `RateLimiter`, `compressImage`, `useSessionTimeout` 30m, `useDebounce`, `staleTime 30s`.

---

## Known Limitations

- **Ground vs Paper:** Digital cadastral `Geometry` vs physical boundaries can diverge → disputes need human field verification.
- **Degraded Documents:** Centuries-old / torn handwriting → Gemini may hallucinate → flagged `confidence <0.5` + `Verify/Reject` human-in-loop.
- **Judicial Overrides:** Court stay orders halt digital SLA workflows → manual tracking outside system.
- **Digital Divide:** Rural owners may lack portal literacy → needs facilitation centers.
- **No Demo Data:** Without `VITE_SUPABASE_URL` the app shows "Database not connected" instead of fake data — fill `.env` and apply SQL migrations for live.
- **Bundle Size:** `recharts`+`maplibre-gl` → chunks ~356KB (Dashboard) / ~979KB (MapLibre) — code-split per route mitigates; `vite` warns >500KB.
- **Seed Data:** `002_seed.sql` must be run via Supabase SQL Editor (RLS blocks anon truncate).
- **IndicTrans2 Server:** Separate Python process (`indictrans-server/`) — not deployed on Vercel; run locally or on GPU instance.

---

## Contributing

```bash
git clone https://github.com/MAYANKJOSHIcoder/RTNLAMS.git
cd RTNLAMS
npm install
cp .env.example .env   # fill keys

# Supabase SQL Editor → 001_schema.sql → 002_seed.sql → register users → set-role.mjs
# Create `documents` bucket in Supabase Dashboard (if migration not applied)

# Start IndicTrans2 server for real translation
cd indictrans-server && ./start.sh

npm run dev
```

Conventions: `import.meta.env.VITE_*` only, `zod` before DB, `sanitizeString` on text, `isSupabaseConfigured()` guards, `skills/ui-ux-pro-max` for a11y (`focus:ring`, 44px targets, `aria-*`).

---

## Verification Checklist

- [x] All routes (`/`, `/login`, `/register`, `/dashboard`, `/parcels`, `/documents`, `/hearings`, `/compensation`, `/audit`) split via `React.lazy` + `* → /`
- [x] Auth `Login→/dashboard` / `Register→user_profiles` works (mock passes, live when `.env` filled)
- [x] Map renders 30 sample parcels (Delhi/Mumbai mocks when not configured, PostGIS when live)
- [x] Upload 10MB drag-drop → Storage `documents` bucket + `useGeminiExtraction` hybrid mock JSON (live when keys filled)
- [x] Stage advancement validates `canAdvance` no-skip + SLA breach detection
- [x] Detail routes `/:id` for Documents/Hearings/Compensation/Audit work
- [x] Document "View" opens OCR/detail modal with extracted fields, translation, confidence
- [x] StageTimeline interactive — click current stage → confirm advance
- [x] No console errors on `npm run build` (2030 modules) + mobile responsive
- [x] `vercel.json` CSP/HSTS/cache + `useSessionTimeout` 30m + `useDebounce` 300ms + `compressImage` + `ErrorBoundary` + `LoadingScreen`

---

## License

Academic MVP for IGDTUW — not a production government system. MIT where applicable.