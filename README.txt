================================================================================
RTNLAMS — REAL-TIME NATIONAL LAND ACQUISITION & MANAGEMENT SYSTEM
================================================================================
Comprehensive Application Documentation & Architecture Manual
Team: Hercules29 • SIH 2026
Platform: Web Application (Vite + React 19 + TypeScript + Supabase + PostGIS)
================================================================================


--------------------------------------------------------------------------------
TABLE OF CONTENTS
--------------------------------------------------------------------------------
1.  EXECUTIVE SUMMARY & PROBLEM STATEMENT
2.  WHAT THE APPLICATION DOES (KEY CAPABILITIES)
3.  CORE ARCHITECTURE & TECHNOLOGY STACK
4.  HOW THE APPLICATION WORKS (END-TO-END DATA FLOW)
5.  THE 12-STAGE STATUTORY ACQUISITION LIFECYCLE
6.  INDIC DOCUMENT INTELLIGENCE PIPELINE (OCR + TRANSLATE + EXTRACT)
7.  GIS PARCEL MAPPING & SPATIAL QUERIES
8.  AUTOMATED 7-FACTOR DYNAMIC RISK SCORING ENGINE
9.  STATUTORY COMPENSATION ENGINE & PAYMENT TRACKER
10. HEARINGS, PUBLIC CONSULTATION & AUDIT SURVEILLANCE
11. CITIZEN GRIEVANCE & QUERY RESOLUTION SYSTEM
12. USER ROLES, RBAC & ROW LEVEL SECURITY (RLS)
13. DATABASE SCHEMA & STORAGE STRUCTURE
14. REPOSITORY DIRECTORY STRUCTURE
15. STEP-BY-STEP INSTALLATION & RUN GUIDE
16. END-TO-END USER JOURNEYS (WALKTHROUGHS)
17. LIMITATIONS, EDGE CASES & MITIGATIONS


================================================================================
1. EXECUTIVE SUMMARY & PROBLEM STATEMENT
================================================================================
Land acquisition in India for mega-infrastructure projects (highways, expressways,
dedicated freight corridors, industrial corridors, and high-speed rail) is 
historically infamous for being:
  - Slow and opaque: Physical paper files moving between district collectorates,
    revenue offices, and central ministries take 4 to 8 years per project.
  - Dispute-prone: Discrepancies between historical handwritten land deeds
    (written in diverse Indic languages and local scripts) and modern spatial
    cadastral maps cause prolonged litigation in courts.
  - Lacking real-time visibility: Project directors and central ministries lack
    a unified control tower to know exactly which parcel is stuck at which
    statutory stage and why.
  - Unfriendly to citizens: Affected landowners and farmers have zero transparency
    into their compensation calculations, award status, or hearing dates.

RTNLAMS (Real-Time National Land Acquisition & Management System) is an 
all-in-one digital control tower and spatial governance platform. It unites:
  1. GIS Parcel Mapping (interactive satellite & cadastral mapping)
  2. Automated 12-Stage Statutory Workflows (aligned with India's RFCTLARR Act, 2013)
  3. Indic Document Intelligence (Edge OCR + Translation + AI Structured Extraction)
  4. Real-Time Dynamic Risk & SLA Breach Detection
  5. Automated Statutory Compensation & Grievance Redressal

Mission: Accelerate national infrastructure by transforming the land acquisition
chain into a seamless, transparent "Document -> Parcel -> Decision" pipeline.


================================================================================
2. WHAT THE APPLICATION DOES (KEY CAPABILITIES)
================================================================================

A. Unified Control Tower Dashboard
   - Displays real-time executive KPIs: Active Projects, Parcels in Progress,
     Critical SLA Breaches, High-Risk Parcels, and Total Compensation Disbursed.
   - Interactive 60/40 Split: Live spatial map visualization alongside the
     12-stage statutory acquisition pipeline bar chart.
   - Auto-refreshes every 30 seconds via TanStack React Query to reflect live
     ground updates without manual page reloading.
   - Live Activity Feed and high-priority Risk Alerts.

B. Interactive GIS Parcel Mapping
   - MapLibre GL JS engine rendering cadastral parcel polygons over OpenStreetMap
     base tiles and Esri World Imagery (satellite layer).
   - Dynamic parcel status coloring (Identified, Notified, Surveyed, Acquired, Disputed).
   - Spatial filters: Bounding-box search, corridor polygon matching, radius buffer
     searches, and centroid navigation.
   - Parcel inspection popups with instant drill-down to full dossier.

C. 12-Stage Statutory Lifecycle Tracker
   - Encodes the full statutory lifecycle from RFCTLARR Act, 2013:
     Corridor Planning -> Preliminary Survey -> SIA -> Section 19 Notification ->
     Objection Handling -> Public Hearing -> Valuation -> Award Declaration ->
     Compensation Deposit -> Possession Handover -> Title Transfer -> Satellite Monitoring.
   - Enforces strict statutory sequence: Parcels CANNOT skip mandatory stages.
   - SLA tracking with automatic breach escalation when deadlines are exceeded.
   - Interactive Kanban stage board with drag-and-drop progression validation.

D. Indic Document Intelligence (3-Tier Hybrid Pipeline)
   - Edge OCR: Scans land records and handwritten deeds directly in the browser
     using Tesseract.js (preserving privacy and cutting server costs).
   - Neural Translation: Translates local Indic vernacular legal text into English
     using AI4Bharat IndicTrans2.
   - Structured Field Extraction: Extracts owner names, Aadhaar numbers, survey
     numbers, plot areas, and village/tehsil names using Google Gemini 2.0 Flash.
   - Human-in-the-Loop: Documents with extraction confidence below 50% are
     automatically flagged for manual officer verification.

E. Dynamic 7-Factor Risk Scoring
   - Automated mathematical model re-evaluating risk (0.0 to 1.0) on every parcel event:
     * Ownership Clarity (25% weight)
     * Litigation & Dispute Status (20% weight)
     * Compensation SLA Adherence (15% weight)
     * Record Completeness (15% weight)
     * Document Quality & OCR Confidence (10% weight)
     * Area Discrepancy between Deed & Map (10% weight)
     * Encroachment & Physical Audit Flags (5% weight)
   - Risk levels: Low (0.0-0.3), Medium (0.3-0.6), High (0.6-0.8), Critical (0.8-1.0).

F. Statutory Compensation Engine
   - Deterministic statutory compensation calculator:
     Award = Circle Rate (INR/sqm) x Land Area (sqm) x Land Use Multiplier x
             Market Multiplier x (1 - Depreciation + Upgrade)
   - Supports statutory land-use multipliers (agricultural, residential, commercial,
     industrial, forest, barren) and market premiums.
   - 30-day payment SLA monitoring from award declaration to escrow deposit.
   - Manual override with mandatory justification audit trail.

G. Comprehensive Hearings & Continuous Audit
   - Schedule and track Gram Sabha, objection, valuation, and final award hearings.
   - Digital attendee rolls (JSONB) and formal minutes uploaded directly to storage.
   - Audit trail capturing satellite surveillance, field inspections, and legal
     compliance findings with severity ratings and photo evidence.

H. Citizen Grievance & Query Resolution Portal
   - Citizens log in to view their specific land records and compensation status.
   - Direct query submission across 7 categories (Compensation, Survey, Documents, etc.).
   - Threaded two-way communication between citizens and acquisition officers.
   - Real-time in-app notification bell with instant deep linking.


================================================================================
3. CORE ARCHITECTURE & TECHNOLOGY STACK
================================================================================

RTNLAMS is designed with a modern, serverless, database-centric architecture:
  * No heavy custom Express/Node server to maintain.
  * All business rules, spatial queries, and access control reside in PostgreSQL
    via Row Level Security (RLS) and PostGIS SQL functions.
  * Only one external serverless proxy is needed: /api/gemini.ts for secure,
    rate-limited AI calls where API keys remain secret.

[ FRONTEND ]
  - Framework: Vite + React 19 + TypeScript (Strict typing, fast HMR)
  - Styling: Tailwind CSS v4 (Zero-runtime, @theme token architecture)
  - UI Library: Handcrafted shadcn/ui primitives + Lucide React icons
  - Maps: MapLibre GL JS + OpenStreetMap tiles + Esri World Imagery (Satellite)
  - State Management: @tanstack/react-query (30-second polling, query caching)
  - Validation: Zod schemas + React Hook Form (Client-side validation before DB)
  - Charts: Recharts (Data-dense KPI charts, pipeline bars, compensation gauge)

[ BACKEND & DATABASE ]
  - Backend-as-a-Service: Supabase
  - Relational Database: PostgreSQL 15+
  - Spatial Engine: PostGIS (GEOMETRY(POLYGON, 4326), ST_Intersects, ST_Within, ST_DWithin)
  - Authentication: Supabase GoTrue Auth (JWT with role claims)
  - Object Storage: Supabase Storage (Buckets: documents, audit-evidence, hearing-minutes)
  - Security Boundary: PostgreSQL Row Level Security (RLS) on all tables

[ ARTIFICIAL INTELLIGENCE & OCR ]
  - Client-Side OCR: Tesseract.js (Edge processing inside the browser)
  - Translation: AI4Bharat IndicTrans2 (Python FastAPI sidecar server)
  - LLM Extraction: Google Gemini 2.0 Flash (via Vercel Serverless Function proxy)

[ DEPLOYMENT & HOSTING ]
  - Frontend & Serverless: Vercel (SPA routing, CSP/HSTS headers, /api/gemini.ts proxy)
  - Database & Storage: Supabase Cloud
  - IndicTrans2: Self-hosted Python FastAPI server (local or GPU instance)


================================================================================
4. HOW THE APPLICATION WORKS (END-TO-END DATA FLOW)
================================================================================

Step 1: User Authentication & Role Hydration
  - User logs in via Supabase Auth (/login or /register).
  - AuthContext captures the session and fetches the user's role from public.user_profiles
    (Roles: admin, field_officer, auditor, citizen).
  - The PostgreSQL RLS engine uses auth.uid() to automatically restrict all queries.

Step 2: Document Ingestion & Edge OCR
  - Citizen or Officer uploads a land deed or revenue record (PDF/JPG/PNG up to 10MB).
  - File is uploaded to Supabase Storage bucket 'documents'.
  - Document record created in public.documents with status = 'processing'.
  - Tesseract.js runs in-browser OCR, extracting raw vernacular text.

Step 3: Translation & AI Field Extraction
  - Extracted text is sent to the IndicTrans2 server (:8080/translate), translating
    Indic languages (Hindi, Marathi, etc.) to English.
  - Image data and prompt are dispatched to the serverless proxy /api/gemini.ts.
  - The proxy validates the Supabase JWT, enforces a 15 req/min rate limit, and calls
    Google Gemini 2.0 Flash.
  - Gemini outputs structured JSON (Owner Name, Survey No, Plot Area, Village, District)
    and an extraction confidence score (0.0 to 1.0).
  - If confidence < 0.5, status becomes 'flagged' for human review; otherwise 'extracted'.

Step 4: Parcel Creation & Spatial Alignment
  - Extracted data is linked to a parcel record with PostGIS polygon geometry.
  - Spatial RPCs check if the parcel intersects the planned corridor (ST_Intersects).
  - Parcel is assigned to a designated Project (e.g., Delhi-Mumbai Expressway).

Step 5: Lifecycle & Statutory Progression
  - Database trigger auto-generates all 12 stages in public.acquisition_stages.
  - Field Officers execute tasks per stage.
  - Progression requires officer sign-off; the system verifies that the previous stage
    is completed and that no SLA breach is unaddressed.

Step 6: Real-Time Risk Re-Assessment
  - Whenever a document is verified, a stage is completed, or an audit log is filed,
    the 7-factor risk scoring engine executes automatically.
  - The parcel's risk_score and risk_level (low, medium, high, critical) are updated.

Step 7: Hearing, Compensation & Handover
  - Valuation reports are generated; statutory compensation is computed automatically.
  - Objection and valuation hearings are conducted and recorded with minutes.
  - Compensation payment is tracked through 30-day SLA to completion.
  - Title transfer is executed, and ongoing satellite surveillance begins.


================================================================================
5. THE 12-STAGE STATUTORY ACQUISITION LIFECYCLE
================================================================================

Every parcel proceeds through 12 formal stages aligned with the RFCTLARR Act, 2013:

+-------+-----------------------------+----------+------------------------------------------+
| Stage | Name                        | SLA Days | Description                              |
+-------+-----------------------------+----------+------------------------------------------+
| 1     | Corridor Planning           | None     | Alignment mapping & corridor matching   |
| 2     | Preliminary Survey          | 15 days  | Field survey & cadastral plot identification |
| 3     | Social Impact Assessment    | 30 days  | SIA study & affected family enumeration  |
| 4     | Notification U/S 19         | 30 days  | Formal acquisition notice publication    |
| 5     | Objection Handling          | 30 days  | Section 15 objection disposal            |
| 6     | Public Hearing              | 15 days  | Gram Sabha consultation & minutes        |
| 7     | Valuation Report            | 30 days  | Collector valuation of land & assets     |
| 8     | Award Declaration           | 30 days  | Formal award declaration under Sec 23    |
| 9     | Compensation Deposit        | 30 days  | Escrow deposit & payment disbursement    |
| 10    | Possession Handover         | 15 days  | Physical takeover by acquiring authority |
| 11    | Title Transfer              | 30 days  | Mutation & revenue record update         |
| 12    | Satellite Monitoring        | None     | Post-possession encroachment monitoring  |
+-------+-----------------------------+----------+------------------------------------------+

Validation Rules (stages.ts):
  - No Skipping: A parcel at Stage 3 cannot move to Stage 5 without completing Stage 4.
  - No Reverting: Once a stage is marked 'completed', it cannot be rewound.
  - Breach Gate: If a stage's SLA deadline passes, status turns 'breached'. The breach
    must be formally resolved before the parcel can advance further.


================================================================================
6. INDIC DOCUMENT INTELLIGENCE PIPELINE (OCR + TRANSLATE + EXTRACT)
================================================================================

Land records in India are predominantly in regional languages (Hindi, Marathi,
Gujarati, Tamil, Telugu, etc.), often handwritten, stamped, and weathered.

The 3-Tier Processing Pipeline:
  1. Edge OCR (Tesseract.js):
     - Executed directly inside the browser using WebAssembly.
     - Extracts vernacular character strings without sending massive raw image bytes
       to heavy third-party servers.
  2. Neural Translation (IndicTrans2):
     - Calls the local/remote IndicTrans2 FastAPI server (:8080/translate).
     - Translates revenue terms (Khasra, Khatauni, Bigha, Guntha, Patwari) into
       standardized English legal terminology.
  3. Structured Extraction & Confidence Scoring (Google Gemini 2.0 Flash):
     - The document image is sent via the secure serverless proxy (/api/gemini.ts).
     - Gemini parses the document and extracts a structured JSON object:
       * Owner Name
       * Aadhaar Number (if available)
       * Survey / Khasra Number
       * Land Area (with unit conversion)
       * Village / Tehsil / District
       * Overall Confidence Score (0.0 to 1.0)
       * Per-field Confidence Scores & Warnings

Human-in-the-Loop Verification:
  - If overall confidence >= 0.5: Document is marked 'extracted'.
  - If overall confidence < 0.5: Document is marked 'flagged'.
  - Officers can review side-by-side original image, translated text, and extracted
    values in the Document Viewer modal and click 'Verify' or 'Reject'.


================================================================================
7. GIS PARCEL MAPPING & SPATIAL QUERIES
================================================================================

The GIS subsystem renders cadastral polygons and performs spatial analysis:
  - Map Engine: MapLibre GL JS (lightweight, open-source fork of Mapbox GL).
  - Base Maps: OpenStreetMap (OSM) vector/raster base layer + Esri World Imagery
    satellite layer (free high-resolution tiles, no vendor API key required).
  - Dynamic Coloring by Status:
    * Identified: Gray / Slate
    * Notified: Blue
    * Surveyed: Amber / Yellow
    * Acquired: Emerald / Green
    * Disputed: Rose / Red

Spatial PostGIS Functions (RPCs):
  1. parcels_within_bbox(min_lng, min_lat, max_lng, max_lat):
     Fetches only parcels visible within the current map viewport.
  2. parcels_nearby(center_lng, center_lat, radius_meters):
     Queries parcels within a radial buffer distance of a given point.
  3. parcels_intersecting_corridor(project_id, buffer_meters):
     Executes ST_Intersects between parcels and the highway/railway corridor line
     buffered by the specified corridor width in meters.
  4. get_parcel_current_stages(project_id):
     Computes the exact active stage count for all parcels in a project in a single
     optimized SQL query.


================================================================================
8. AUTOMATED 7-FACTOR DYNAMIC RISK SCORING ENGINE
================================================================================

The risk engine computes a composite risk score (0.0 to 1.0) to highlight parcels
that threaten project completion timelines.

Formula:
  Overall Risk = (Ownership * 0.25) +
                 (Litigation * 0.20) +
                 (CompensationSLA * 0.15) +
                 (Completeness * 0.15) +
                 (DocumentQuality * 0.10) +
                 (AreaDiscrepancy * 0.10) +
                 (Encroachment * 0.05)

Factor Details:
  1. Ownership Clarity (0.25):
     - Clean (0.10): Verified deed + valid Aadhaar on file.
     - Unverified (0.50): Documents uploaded but unverified.
     - Risky (0.70-0.80): Missing Aadhaar or no deeds uploaded.
  2. Litigation & Disputes (0.20):
     - Disputed parcel status = 0.90; Active objection hearings = +0.15;
     - Critical unresolved audit findings = +0.30.
  3. Compensation SLA (0.15):
     - Measures stage delays. If Stages 7-9 (Valuation/Award/Deposit) breach SLA,
       this score surges towards 1.0.
  4. Data Completeness (0.15):
     - Missing cadastral geometry, missing survey number, or unmapped boundaries.
  5. Document Quality (0.10):
     - Directly derived from OCR confidence (1.0 - confidence).
  6. Area Discrepancy (0.10):
     - Compares deed-stated area against the GIS polygon area (ST_Area).
     - Variance > 5% increases risk proportionally.
  7. Encroachment & Physical Audit (0.05):
     - Satellite or field audit reports indicating illegal structures or encroachments.


================================================================================
9. STATUTORY COMPENSATION ENGINE & PAYMENT TRACKER
================================================================================

RTNLAMS implements the statutory compensation calculation model:

Base Calculation Formula:
  Awarded Amount = Circle Rate (INR/sqm) x Area (sqm) x Land Use Multiplier x
                   Market Multiplier x (1 - Depreciation + Upgrade)

Land Use Multipliers:
  - Agricultural: 1.0x
  - Residential:  1.4x
  - Commercial:   1.8x
  - Industrial:   1.3x
  - Forest:       1.2x
  - Barren:       0.7x

Market Multiplier:
  - Default: 1.15x (15% statutory solatium/market premium).

Manual Overrides:
  - Authorized officers can override calculated amounts to comply with court awards
    or special rehabilitation packages.
  - A mandatory text justification ('manual_reason') is logged permanently.

Payment Workflow & SLA:
  - Statuses: pending -> initiated -> completed | failed.
  - 30-Day SLA: Compensation must be deposited within 30 days of the Award Declaration.
  - Live charts visualize awarded vs. disbursed amounts and breach warnings.


================================================================================
10. HEARINGS, PUBLIC CONSULTATION & AUDIT SURVEILLANCE
================================================================================

Hearings Module:
  - Types: Objection (Sec 15), Valuation, Final Award, Public Consultation (Gram Sabha).
  - Schedule calendar with parcel linkage.
  - Attendee roster stored as JSONB array [{ name, role }].
  - Formal signed minutes uploaded directly to Supabase Storage 'hearing-minutes'.

Audit & Surveillance Module:
  - Types:
    * Satellite: Remote sensing checks for land clearing and encroachment.
    * Field: Physical site visits by field revenue inspectors.
    * Compliance: Statutory and legal checks.
  - Severity: Low, Medium, High, Critical.
  - Photo evidence uploaded to Supabase Storage 'audit-evidence'.
  - Unresolved critical audits automatically escalate parcel risk scores.


================================================================================
11. CITIZEN GRIEVANCE & QUERY RESOLUTION SYSTEM
================================================================================

To ensure total transparency and minimize court litigation, RTNLAMS provides
a real-time query resolution system:

Categories:
  - Land Record, Document, Compensation, Survey, Acquisition, Payment, Other.

Workflow:
  1. Citizen creates a query referencing their parcel.
  2. Query appears on the officer's Query Management page with 'open' status.
  3. Officers and citizens communicate through threaded chat messages.
  4. Status advances: open -> under_review -> resolved (or reopened if needed).
  5. Notification Triggers: When an officer replies or resolves a query, a database
     trigger inserts a notification in public.notifications.
  6. The user's header notification bell updates instantly with a deep-link badge.


================================================================================
12. USER ROLES, RBAC & ROW LEVEL SECURITY (RLS)
================================================================================

Access control is strictly enforced at the database layer using PostgreSQL RLS:

Role Matrix:
+----------------+---------------+-----------------------------------------------+
| Role           | UI Access     | Database Permissions                          |
+----------------+---------------+-----------------------------------------------+
| admin          | All pages     | Full read/write across all projects & tables  |
| field_officer  | Staff pages   | Read/write parcels, documents, stages, hearings|
| auditor        | Audit & view  | Read-all; write audit_logs; cannot edit awards |
| citizen        | Portal view   | Read ONLY parcels linked to their Aadhaar;     |
|                |               | Create & read own documents and queries       |
+----------------+---------------+-----------------------------------------------+

Security Enforcements:
  - Profile Guard: A database trigger (guard_profile_updates) prevents any user
    from elevating their own role or editing another user's Aadhaar.
  - Storage Policies: Per-bucket RLS prevents citizens from accessing unapproved
    evidence buckets or overwriting other users' documents.
  - API Key Safety: The GEMINI_API_KEY is stored only in the serverless environment
    and NEVER exposed to client bundles.


================================================================================
13. DATABASE SCHEMA & STORAGE STRUCTURE
================================================================================

Core Tables:
  1. public.user_profiles
     - id (UUID, FK auth.users), full_name, role, aadhaar, phone, avatar_url.
  2. public.projects
     - id, name, description, corridor_type, status, total_parcels, corridor_geometry.
  3. public.parcels
     - id, project_id, parcel_number, owner_name, owner_aadhaar, area_hectares,
       land_use, geometry (PostGIS Geometry Polygon 4326), status, risk_score.
  4. public.documents
     - id, parcel_id, doc_type, file_url, ocr_extracted_data (JSONB), ocr_raw_text,
       translated_text, ocr_confidence, language, status, uploaded_by.
  5. public.acquisition_stages
     - id, parcel_id, stage_number (1-12), stage_name, status, sla_deadline, completed_at.
  6. public.hearings
     - id, parcel_id, hearing_date, type, outcome, attendees (JSONB), minutes_file_url.
  7. public.compensation_awards
     - id, parcel_id, calculated_amount, awarded_amount, payment_status, circle_rate_per_sqm.
  8. public.audit_logs
     - id, parcel_id, audit_type, finding, severity, image_url, resolved.
  9. public.risk_assessments
     - id, parcel_id, ownership_score, litigation_score, compensation_sla_score,
       overall_risk, risk_level, factors (JSONB).
  10. public.raised_queries
     - id, parcel_id, citizen_id, category, subject, description, status, assigned_to.
  11. public.query_messages
     - id, query_id, sender_id, message, attachment_path, created_at.
  12. public.notifications
     - id, user_id, title, message, entity_type, entity_id, is_read.

Storage Buckets:
  - documents: Land deeds, title papers, revenue maps.
  - audit-evidence: Ground photos, satellite capture evidence.
  - hearing-minutes: Signed proceedings from Gram Sabhas and hearings.


================================================================================
14. REPOSITORY DIRECTORY STRUCTURE
================================================================================

RTNLAMS/
├── api/
│   └── gemini.ts               # Vercel serverless proxy for Google Gemini (JWT-gated)
├── indictrans-server/
│   ├── app.py                  # FastAPI translation microservice (AI4Bharat)
│   ├── download_models.py      # HuggingFace model downloader
│   ├── start.sh / start.bat    # Server startup scripts
│   └── requirements.txt        # PyTorch & IndicTrans dependencies
├── public/                     # Static icons, favicons, Tesseract assets
├── scripts/
│   ├── set-role.mjs            # CLI tool to assign roles and Aadhaar numbers
│   └── sync-tesseract-assets.mjs # Pre-dev script bundling Tesseract worker files
├── src/
│   ├── components/
│   │   ├── audit/              # AuditLog, AuditForm
│   │   ├── common/             # RoleGate, ServiceHealth
│   │   ├── compensation/       # CompensationCalculator, PaymentDashboard
│   │   ├── dashboard/          # ControlTowerKPIs, PipelineBar, RiskAlerts
│   │   ├── documents/          # DocumentUpload, DocumentList, OCRReviewModal
│   │   ├── hearings/           # HearingForm, HearingCalendar
│   │   ├── layout/             # Header, Sidebar, Footer, NotificationBell
│   │   ├── maps/               # ParcelMap, MapControls (MapLibre + Esri)
│   │   ├── parcels/            # ParcelTable, ParcelModal, CSVUpload
│   │   ├── queries/            # QueryDetailModal, QueryThread
│   │   └── ui/                 # Handcrafted shadcn primitives (Button, Modal, Card...)
│   ├── context/
│   │   ├── AuthContext.tsx     # Supabase Auth state, profile, and roles
│   │   └── ProjectContext.tsx  # Global selected project state
│   ├── hooks/                  # Custom React Query hooks (useParcels, useStages, etc.)
│   ├── lib/
│   │   ├── gemini/             # Gemini client, rate-limiter, prompt templates
│   │   ├── supabase/           # Typed Supabase client & PostGIS queries
│   │   ├── compensation.ts     # Statutory compensation math formulas
│   │   ├── config.ts           # Environment variable validation
│   │   ├── permissions.ts      # Role-based capability matrices
│   │   ├── risk.ts             # 7-factor risk scoring calculations
│   │   ├── stages.ts           # 12-stage lifecycle engine & SLA rules
│   │   └── types/              # Comprehensive TypeScript interfaces
│   ├── pages/
│   │   ├── Landing.tsx         # Public landing page with showcase & stats
│   │   ├── Login.tsx           # Authentication login
│   │   ├── Register.tsx        # User registration
│   │   ├── Dashboard.tsx       # Real-time control tower
│   │   ├── Parcels.tsx         # Parcel hub with 6-tab inspection dossier
│   │   ├── Documents.tsx       # Document repository & OCR review
│   │   ├── Hearings.tsx        # Hearings schedule and minutes
│   │   ├── Compensation.tsx    # Awards, disbursements & SLA tracker
│   │   ├── Audit.tsx           # Satellite & field surveillance logs
│   │   ├── Queries.tsx         # Citizen grievances & resolution threads
│   │   └── Settings.tsx        # System configuration & service health
│   ├── App.tsx                 # Route tree with React.lazy & protected gates
│   └── main.tsx                # Application bootstrap
├── supabase/
│   ├── 000_drop_all.sql        # Clean reset script
│   ├── 001_schema.sql          # Complete DB schema, tables, triggers, PostGIS
│   ├── 002_seed.sql            # Sample data (3 projects, 30 parcels, docs, stages)
│   ├── 003_rls_hardening.sql   # Storage security & invoker rights RPCs
│   ├── 004_corridor_width.sql  # Corridor polygon buffer matching
│   └── 005_queries_notifications.sql # Query resolution & notification triggers
├── package.json                # NPM dependencies and scripts
└── vite.config.ts              # Vite configuration with Tailwind v4 & Vitest


================================================================================
15. STEP-BY-STEP INSTALLATION & RUN GUIDE
================================================================================

Prerequisites:
  - Node.js 18+ and npm
  - A Supabase Project (free tier works)
  - Python 3.10+ (optional, only for running local IndicTrans2 translation server)

Step 1: Clone and Install
  git clone https://github.com/MAYANKJOSHIcoder/RTNLAMS.git
  cd RTNLAMS
  npm install

Step 2: Environment Configuration
  Copy .env.example to .env:
    cp .env.example .env

  Fill in the values in .env:
    # Public variables (compiled into client bundle)
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
    VITE_INDICTRAN_API_URL=http://localhost:8080

    # Serverless secrets (configured in Vercel or local api server, NEVER prefixed with VITE_)
    GEMINI_API_KEY=your_google_gemini_api_key
    GEMINI_MODEL=gemini-3.1-flash-lite

Step 3: Supabase Database Migration
  Open your Supabase Project -> SQL Editor. Run the scripts in the following order:
    1. supabase/001_schema.sql (Creates all tables, PostGIS, triggers, RLS)
    2. supabase/002_seed.sql (Populates demo projects, parcels, documents)
    3. supabase/003_rls_hardening.sql (Applies storage RLS policies)
    4. supabase/004_corridor_width.sql (Adds corridor buffer math)
    5. supabase/005_queries_notifications.sql (Sets up query & notification triggers)

Step 4: Create User Accounts & Assign Roles
  1. Start the application:
     npm run dev
  2. Open http://localhost:5173 and register your accounts via the UI (/register).
     By default, all registered users receive the 'citizen' role.
  3. Assign staff roles using the helper script:
     node scripts/set-role.mjs admin@example.com admin
     node scripts/set-role.mjs officer@example.com field_officer
     node scripts/set-role.mjs auditor@example.com auditor
     node scripts/set-role.mjs citizen@example.com citizen 100000000001
     (Note: Ensure scripts/.env contains SUPABASE_URL and SERVICE_ROLE_KEY).

Step 5: Optional — Run IndicTrans2 Translation Server
  cd indictrans-server
  # On Linux/macOS:
  ./start.sh
  # On Windows:
  start.bat
  (If not running, the application continues gracefully using Gemini translation).

Step 6: Run Application
  npm run dev
  Application opens at http://localhost:5173.


================================================================================
16. END-TO-END USER JOURNEYS (WALKTHROUGHS)
================================================================================

Journey 1: The Citizen
  1. Citizen logs in. Because of RLS, their view is restricted solely to parcels
     matching their registered 12-digit Aadhaar number.
  2. They inspect their parcel on the map, seeing current stage (e.g. Stage 7: Valuation).
  3. They check the Compensation tab to review the circle rate, land use multiplier,
     and calculated payout amount.
  4. If they notice an area discrepancy, they navigate to 'Queries' -> 'Raise Query',
     enter details, and attach supporting papers.
  5. When an officer responds, the citizen sees a red badge on their notification bell
     and can chat directly within the threaded resolution window.

Journey 2: The Field Officer
  1. Officer logs in and selects a project (e.g. "Delhi-Mumbai Expressway").
  2. On the Parcels Hub, they draw or import new parcels or upload land deeds.
  3. When an Indic deed is uploaded, the OCR pipeline extracts fields in seconds.
  4. In the OCR Review Modal, the officer verifies the extracted owner name, survey
     number, and area, then clicks 'Approve'.
  5. The officer conducts the Section 19 notification, schedules hearings, and
     advances the parcel to the next statutory stage.

Journey 3: The Auditor
  1. Auditor logs in and navigates to the Audit module.
  2. They review satellite imagery overlay against the surveyed cadastral boundary.
  3. If unauthorized construction is spotted, the auditor files an audit finding:
     Audit Type: Satellite, Severity: High, Finding: "Encroachment detected on northern parcel line".
  4. They attach photo evidence and submit.
  5. The parcel's 7-factor risk engine immediately surges, alerting the executive dashboard.

Journey 4: The Project Administrator / Director
  1. Director views the Dashboard Control Tower.
  2. High-level KPIs show 12 parcels in Stage 5, with 2 SLA breaches in Stage 9.
  3. They click the breached alert to drill down into the affected parcels and
     dispatch instructions to the designated district collector.


================================================================================
17. LIMITATIONS, EDGE CASES & MITIGATIONS
================================================================================

1. Historical Physical vs. Digital Boundaries:
   - Challenge: Centuries-old revenue maps (shajra) often differ from modern GPS coordinates.
   - Mitigation: PostGIS spatial tolerances and human field verification workflows.
2. Degraded & Ancient Handwritten Manuscripts:
   - Challenge: Severe handwriting degradation can cause LLM hallucinations.
   - Mitigation: Strict confidence thresholding (<0.5 flagged) requiring human sign-off.
3. Court Stay Orders:
   - Challenge: High Courts or Tribunals can issue temporary injunctions halting work.
   - Mitigation: Parcels can be flagged with 'disputed' status, freezing SLA timers.
4. Digital Divide:
   - Challenge: Rural farmers may lack computers or internet access.
   - Mitigation: Facilitation Centers and Field Officers act on citizens' behalf using
     Aadhaar-linked records and physical hearing summons.
5. Vendor Independence:
   - Challenge: High enterprise license fees for mapping and proprietary GIS software.
   - Mitigation: Entirely built on open standards (PostGIS, MapLibre, OpenStreetMap,
     free Esri satellite tiles, and student-tier AI).

================================================================================
END OF DOCUMENTATION MANUAL
================================================================================
