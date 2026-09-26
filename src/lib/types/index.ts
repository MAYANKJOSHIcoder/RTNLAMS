// Hercules29 RTNLAMS (SIH 2026) — Central Type Definitions
// PROMPT 4 — src/lib/types/index.ts
// Covers all 13 interfaces + PostGIS GeoJSON + JSONB + status unions

// ---------------------------------------------------------------------------
// Status Unions (enum-like string literals)
// ---------------------------------------------------------------------------
export type ParcelStatus = 'identified' | 'notified' | 'surveyed' | 'acquired' | 'disputed';
export type DocumentStatus = 'uploaded' | 'processing' | 'extracted' | 'verified' | 'flagged';
export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'breached';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PaymentStatus = 'pending' | 'initiated' | 'completed' | 'failed';
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AuditType = 'satellite' | 'field' | 'compliance';
export type HearingType = 'objection' | 'valuation' | 'final' | 'public';
export type CorridorType = 'highway' | 'rail' | 'industrial' | 'other';
export type UserRole = 'admin' | 'field_officer' | 'auditor' | 'citizen';
export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on_hold';

// ---------------------------------------------------------------------------
// GeoJSON / PostGIS
// ---------------------------------------------------------------------------
// Mirrors GeoJSON spec + PostGIS GEOMETRY(POLYGON,4326) stored as GeoJSON in Supabase
export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] }
  | { type: 'MultiPoint'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] }
  | { type: 'GeometryCollection'; geometries: GeoJsonGeometry[] };

export interface MapFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown> & {
    id: string;
    parcel_number: string;
    status: ParcelStatus;
    risk_level?: RiskLevel;
  };
  id?: string | number;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: MapFeature[];
}

// Generic JSONB helpers
export type JsonRecord = Record<string, unknown>;
export type JsonArray = unknown[];

// ---------------------------------------------------------------------------
// Core Domain Interfaces
// ---------------------------------------------------------------------------
export interface UserProfile {
  id: string; // FK auth.users
  full_name: string;
  email?: string;
  role: UserRole;
  aadhaar?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  created_at: string; // ISO
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  corridor_type: CorridorType;
  status: ProjectStatus;
  total_parcels: number;
  total_area_hectares: number;
  corridor_geometry?: GeoJsonGeometry | null; // optional line/polygon for corridor
  created_by: string | null; // FK user_profiles
  created_at: string;
  updated_at?: string;
}

export interface Parcel {
  id: string;
  project_id: string; // FK projects
  parcel_number: string; // e.g. DL-SURV-001
  owner_name: string;
  owner_aadhaar: string | null; // citizen link for RLS (12-digit)
  area_hectares: number;
  land_use: string | null;
  geometry: GeoJsonGeometry | null; // GEOMETRY(POLYGON,4326)
  latitude?: number | null;
  longitude?: number | null;
  // centroid for map convenience (computed)
  centroid?: { lat: number; lng: number } | null;
  status: ParcelStatus;
  risk_score: number | null; // 0-1
  risk_level?: RiskLevel | null;
  survey_number?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Document {
  id: string;
  parcel_id: string; // FK parcels
  doc_type: string; // deed, survey_map, handwritten_deed, etc.
  file_url: string; // Supabase Storage
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  // OCR / IndicTrans / Gemini extraction
  ocr_extracted_data: JsonRecord | null; // JSONB — structured extraction
  ocr_raw_text?: string | null;
  translated_text?: string | null;
  ocr_confidence: number | null; // 0-1
  language: string | null; // detected language
  status: DocumentStatus;
  uploaded_by: string | null; // FK user_profiles
  verified_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface StageDefinition {
  stage_number: number; // 1-12
  stage_name: string;
  sla_days: number | null; // null for open-ended (1,12)
  description?: string;
}

export interface AcquisitionStage {
  id: string;
  parcel_id: string; // FK parcels
  stage_number: number; // 1-12
  stage_name: string;
  status: StageStatus;
  assigned_to: string | null; // FK user_profiles
  sla_deadline: string | null; // ISO
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Hearing {
  id: string;
  parcel_id: string; // FK parcels
  hearing_date: string; // ISO
  type: HearingType;
  outcome: string | null;
  attendees: JsonArray | null; // JSONB [{ name, role }]
  notes: string | null;
  minutes_file_url?: string | null;
  created_by: string | null; // FK user_profiles
  created_at: string;
  updated_at?: string;
}

export interface CompensationAward {
  id: string;
  parcel_id: string; // FK parcels
  calculated_amount: number | null;
  awarded_amount: number;
  payment_status: PaymentStatus;
  payment_date: string | null;
  payment_reference: string | null;
  circle_rate_per_sqm?: number | null;
  area_sqm?: number | null;
  multiplier?: JsonRecord | null; // land_use, market etc.
  created_at: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  parcel_id: string | null; // FK parcels (nullable for project-level)
  audit_type: AuditType;
  finding: string;
  severity: AuditSeverity;
  image_url: string | null;
  resolved: boolean;
  resolved_at?: string | null;
  created_by: string | null; // FK user_profiles
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  parcel_id: string; // FK parcels
  ownership_score: number; // 0-1
  litigation_score: number;
  compensation_sla_score: number;
  completeness_score: number;
  document_quality_score: number;
  area_discrepancy_score: number;
  encroachment_score: number;
  overall_risk: number; // 0-1 weighted sum
  risk_level: RiskLevel;
  factors: JsonRecord | null; // JSONB detail
  assessed_at: string;
  assessed_by?: string | null;
}

// Gemini extraction response (structured JSON from PROMPT 13)
export interface GeminiExtractionResponse {
  original_text: string;
  translated_text: string | null;
  document_language: string | null;
  extracted_fields: JsonRecord;
  confidence: number | null; // overall 0-1
  confidence_per_field?: Record<string, number>;
  warnings?: string[];
}

// Supabase bbox query helper
export type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

// ---------------------------------------------------------------------------
// Raised Queries & Notifications Domain Types
// ---------------------------------------------------------------------------
export type QueryCategory =
  | 'Land Record'
  | 'Document'
  | 'Compensation'
  | 'Survey'
  | 'Acquisition'
  | 'Payment'
  | 'Other';

export type QueryStatus = 'open' | 'under_review' | 'resolved' | 'reopened';

export interface RaisedQuery {
  id: string;
  parcel_id: string;
  citizen_id: string;
  category: QueryCategory;
  subject: string;
  description: string;
  status: QueryStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  // joined metadata
  citizen?: {
    full_name: string;
    aadhaar?: string | null;
    phone?: string | null;
  } | null;
  parcel?: {
    parcel_number: string;
    village?: string | null;
  } | null;
  assigned_officer?: {
    full_name: string;
  } | null;
}

export interface QueryMessage {
  id: string;
  query_id: string;
  sender_id: string;
  message: string;
  attachment_path: string | null;
  created_at: string;
  sender?: {
    full_name: string;
    role: UserRole;
  } | null;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string | null;
  parcel_id: string | null;
  query_id: string | null;
  is_read: boolean;
  created_at: string;
}

