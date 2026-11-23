/**
 * Typed client for the PUBLIC intelligence entity endpoints —
 * mirrors app/schemas/intelligence_entities.py on the FastAPI side.
 *
 * These are the public-hub endpoints (slug / regulation_key identifiers,
 * is_published / verified gated). The internal dashboard uses the separate
 * numeric-id clients in companies.ts / regulations.ts — do not mix.
 *
 * Unauthenticated: the hub is public, so plain fetch (same convention as
 * app/(hub)/intelligence/page.tsx), no Clerk dependency.
 *
 * NOTE (informative-first launch, 2026-07-15): the API returns band /
 * risk_score fields; the frontend deliberately does not render them yet.
 * Types keep the fields so scores can light up without client changes.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = `${API_BASE}/api/v1/intelligence`;

export interface RiskBandOut {
  label: string;
  level: "low" | "med" | "high" | "crit";
  score: number | null;
}

export interface PublicCompanyListItem {
  slug: string;
  name: string;
  legal_name: string | null;
  stage_label: string | null;
  hq_country: string | null;
  materials: string[];
  band: RiskBandOut | null; // not rendered at launch
}

export interface CompanyFactOut {
  label: string;
  value: string;
  mono: boolean;
}

/** "Market + map" v4 (2026-07-21): ONE deduped row per material, stages
 *  combined into stage_label ("Refining · Cell"). risk_score is the
 *  material's GLOBAL rollup (sidebar-consistent, gated) — the where-
 *  question lives entirely in GeoFootprintOut, hence no geography or
 *  score_basis fields anymore. */
export interface ExposureOut {
  material: string;
  stage_label: string | null; // combined, e.g. "Refining · Cell"
  risk_score: number | null;  // 0-100 global rollup; null = gated/unscored
  band: RiskBandOut | null;
}

/** One material's L1 score at this country (chip). */
export interface GeoFootprintMaterialOut {
  material: string;
  score: number; // 0-100, 1dp
  level: "low" | "med" | "high" | "crit";
}

/** One country the company operates or sources in — "market + map" v4,
 *  replacing the per-facility list. The ONLY section with per-geography
 *  scores; exposure rows are global-only. */
export interface GeoFootprintOut {
  country: string; // ISO2
  facility_count: number; // 0 = sourcing-only country
  activities: string[]; // distinct facility types, sorted
  sourcing_materials: string[]; // materials CME says are sourced here
  location_risk: RiskBandOut | null; // max across chips (server sort key)
  materials: GeoFootprintMaterialOut[]; // chips, score desc
}

export interface LinkedPostOut {
  slug: string;
  title: string;
  content_type: string;
  pillar: string | null;
  materials: string[] | null;
  geographies: string[] | null;
  summary: string | null;
  published_at: string | null;
  read_time_minutes: number | null;
}

export interface LinkedEventOut {
  title: string;
  event_type: string;
  event_subtype: string | null;
  event_date: string | null;
  severity_score: number | null;
}

export interface PublicCompanyProfile {
  slug: string;
  name: string;
  legal_name: string | null;
  band: RiskBandOut | null; // not rendered at launch
  facts: CompanyFactOut[];
  intro: string | null; // companies.public_intro — omit lede when null
  exposures: ExposureOut[];
  geographies: GeoFootprintOut[];
  facilities_total: number; // total facilities across all countries
  linked_posts: LinkedPostOut[];   // rendered since 2026-07-22 (LinkedPostsSection)
  linked_events: LinkedEventOut[]; // hidden at launch
}

export interface PublicRegulationListItem {
  regulation_key: string;
  title: string | null;
  issuer: string | null;
  geography: string | null;
  theme: string | null; // display label; null = pending triage → render "—"
  status: string | null;
  status_level: "inforce" | "proposed" | "pending" | "ended" | null;
  effective_date: string | null;
}

export interface TimelineNodeOut {
  label: string; // fixed strip: Proposed | Enacted | Effective
  date: string | null;
  note: string | null;
  active: boolean; // current stage
  future: boolean; // stage not yet reached
}

export interface MaterialScopeOut {
  material: string;
  scope_type: string;
  severity_multiplier: number | null; // not rendered at launch
}

export interface GeographyScopeOut {
  country_code: string;
  scope_type: string;
}

export interface ComplianceWeightOut {
  country_code: string;
  weight: number;
}

export interface FurtherReadingOut {
  title: string;
  publisher: string;
  url: string;
}

// Workbook-curated editorial block (Editorial / FurtherReading sheets,
// 2026-07-23). Section keys render in EDITORIAL_SECTION_ORDER.
export interface EditorialOut {
  standfirst: string | null;
  sections: Record<string, string>;
  further_reading: FurtherReadingOut[];
}

export interface PublicRegulationDetail {
  regulation_key: string;
  title: string | null;
  issuer: string | null;
  geography: string | null;
  theme: string | null;
  status: string | null;
  status_level: string | null;
  summary: string | null;
  editorial: EditorialOut | null;
  timeline: TimelineNodeOut[];
  materials_scope: MaterialScopeOut[];
  geographies_scope: GeographyScopeOut[];
  compliance_weights: ComplianceWeightOut[]; // not rendered at launch
  source_url: string | null;
  linked_posts: LinkedPostOut[];   // rendered since 2026-07-22 (LinkedPostsSection)
  linked_events: LinkedEventOut[]; // hidden at launch
  linked_event_count: number;
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Browse: one fetch, client-side filtering — the published catalog is
 *  ~25 companies / ~9 verified regulations at launch. Revisit server-side
 *  q/stage/theme params when the catalogs outgrow one page. */
export function listPublicCompanies(limit = 100) {
  return getJson<Paginated<PublicCompanyListItem>>(
    `${BASE}/companies?limit=${limit}`,
  );
}

export interface FacilityMaterialTag {
  material: string;
  level: "low" | "med" | "high" | "crit";
}

export interface FacilityDetailOut {
  name: string | null;
  facility_type: string;
  status: string;
  status_level: "op" | "ramp" | "build" | "idle" | "closed";
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  data_source: string | null;
  materials: FacilityMaterialTag[];
}

export interface CompanyCountryFacilitiesOut {
  country: string;
  country_name: string;
  facilities: FacilityDetailOut[];
}

/** Footprint drawer: facilities for a company in one country. */
export function getCompanyCountryFacilities(slug: string, country: string) {
  return getJson<CompanyCountryFacilitiesOut>(
    `${BASE}/companies/${encodeURIComponent(slug)}/facilities?country=${encodeURIComponent(country)}`,
  );
}

export function getPublicCompany(slug: string) {
  return getJson<PublicCompanyProfile>(
    `${BASE}/companies/${encodeURIComponent(slug)}`,
  );
}

export function listPublicRegulations(limit = 100) {
  return getJson<Paginated<PublicRegulationListItem>>(
    `${BASE}/regulations?limit=${limit}`,
  );
}

export function getPublicRegulation(regulationKey: string) {
  return getJson<PublicRegulationDetail>(
    `${BASE}/regulations/${encodeURIComponent(regulationKey)}`,
  );
}

// ---------------------------------------------------------------------------
// Materials — public profiles (content-site unit Piece C, 2026-10-24)
// ---------------------------------------------------------------------------

export interface PublicShareOut {
  code: string;
  name: string | null;
  share: number; // raw fraction [0,1] — SOURCE data, not a score
}

export interface PublicStageSharesOut {
  stage: string;
  reference_year: number;
  is_driving: boolean;
  sources: string[];
  shares: PublicShareOut[];
}

export interface PublicMaterialRegulationOut {
  regulation_key: string;
  title: string | null;
  geography: string | null;
  status: string | null;
  pillar: string | null;
}

export interface PublicMaterialListItem {
  slug: string;
  name: string;
  band: RiskBandOut;
  /** Stage that set the rating ("refined"…), from stored rescore
   *  diagnostics — the browse row's secondary fact (2026-11-12). */
  driving_stage: string | null;
}

export interface PublicMaterialProfile {
  slug: string;
  name: string;
  band: RiskBandOut;
  as_of_date: string | null;
  stages: PublicStageSharesOut[];
  regulations: PublicMaterialRegulationOut[];
  linked_posts: LinkedPostOut[];
  linked_event_count: number;
}

export async function listPublicMaterials(): Promise<PublicMaterialListItem[]> {
  const res = await fetch(`${BASE}/materials`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function getPublicMaterial(slug: string): Promise<PublicMaterialProfile> {
  const res = await fetch(`${BASE}/materials/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// ---------------------------------------------------------------------------
// Live signals — the public triaged-event feed (C3/C4)
// ---------------------------------------------------------------------------

export interface PublicEventGeo {
  code: string;
  name: string | null;
}

export interface PublicEventItem {
  id: number;
  title: string;
  summary: string | null;
  event_date: string | null;
  event_type: string | null;
  event_subtype: string | null;
  direction: string | null;
  verified: boolean;
  source_name: string | null;
  source_url: string | null;
  materials: string[];
  geographies: PublicEventGeo[];
}

export interface PublicEventsPage {
  data: PublicEventItem[];
  total: number;
  page: number;
  limit: number;
}

export async function listPublicEvents(params: {
  material?: string;
  /** Profile slug — same direct-only filter as `material`, usable
   *  before the profile fetch returns, so pages can load signals in
   *  parallel (2026-11-12). */
  material_slug?: string;
  verified_only?: boolean;
  page?: number;
  limit?: number;
} = {}): Promise<PublicEventsPage> {
  const q = new URLSearchParams();
  if (params.material) q.set("material", params.material);
  if (params.material_slug) q.set("material_slug", params.material_slug);
  if (params.verified_only) q.set("verified_only", "true");
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  const res = await fetch(`${BASE}/events${q.size ? `?${q}` : ""}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** Mirror of the backend's slug derivation (_material_slug). */
export function materialSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
