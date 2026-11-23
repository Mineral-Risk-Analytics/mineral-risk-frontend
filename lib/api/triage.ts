/**
 * Triage API client — the write surface for the event triage queue.
 *
 * Mirrors app/api/routes/triage.py (backend) exactly; if a field is added
 * there, add it here. Types are local to this module: the triage surface is
 * consumed only by the triage page and drawer.
 */

import type { ApiClient } from "./client";

export type TriageStatus =
  | "pending_triage"
  | "scoring"
  | "display_only"
  | "rejected";

export type LinkStatus = "suggested" | "confirmed" | "rejected";

/** Entity kind a link points at.  Only ``material`` is triageable today —
 *  migration 066 added a ``status`` column to ``risk_event_materials`` alone,
 *  so company / facility / regulation links have nowhere to record a triage
 *  decision.  The backend already emits the discriminator so the drawer can
 *  group links by kind without guessing. */
export type LinkKind =
  | "material"
  | "company"
  | "facility"
  | "regulation"
  | "geography";

export interface TriageLink {
  id: number;
  material_id: number;
  label: string;
  status: LinkStatus;
  match_reason: string | null;
  relevance_score: number | null;
  is_direct: boolean;
  kind: LinkKind;
}

/** A data-quality note filed against an event.  Stored in
 *  ``metadata_json["flags"]``; ``id`` is synthesised backend-side because the
 *  notes have no row identity of their own. */
export interface TriageFlag {
  id: string;
  note_type: string;
  note_text: string;
  author: string | null;
  created_at: string | null;
}

export interface TriageEvent {
  id: number;
  title: string;
  summary: string | null;
  event_type: string | null;
  event_subtype: string | null;
  event_date: string | null;
  severity_score: number | null;
  confidence_score: number | null;
  triage_status: TriageStatus;
  suggested_category: string | null;
  primary_category: string | null;
  direction: "restrictive" | "supportive" | "neutral" | null;
  verified: boolean;
  triaged_by: string | null;
  triaged_at: string | null;
  source_system: string | null;
  source_url: string | null;
  geography_primary: string | null;
  suggested_subtype: string | null;
  quality_defects: string[];
  flags_count: number;
  links: TriageLink[];
  /** All pillars the engine attributed, not just the primary. */
  risk_categories: string[];
  /** Primary geography first, then secondaries, de-duplicated in order. */
  geography_codes: string[];
  /** Code → display name, resolved against the backend's `countries` table
   *  and covering only the codes it recognises. Prefer this over
   *  `Intl.DisplayNames`: these codes are whatever `countries.iso2` holds,
   *  which admits bloc identifiers and other non-ISO rows that Intl echoes
   *  back unchanged. A missing key means "not in the reference table" — show
   *  the bare code. */
  geography_names: Record<string, string>;
  /** Served by the backend rather than inferred client-side: the page used to
   *  carry its own copy of the positive-subtype set, which had drifted. */
  is_positive: boolean;
  flags: TriageFlag[];
}

export interface TriageEventList {
  items: TriageEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface TriageSummary {
  pending_triage: number;
  scoring: number;
  display_only: number;
  rejected: number;
  total: number;
}

export interface MaterialCoverageItem {
  material_id: number;
  name: string;
  is_launch_list: boolean;
  /** Direct, confirmed links on live events inside the window. */
  confirmed: number;
  /** Direct, still-suggested links — in the queue, contributing nothing yet. */
  pending: number;
}

export interface MaterialCoverage {
  window_days: number;
  /** The thin-events bar. Served by the backend (it is the dashboard's
   *  coverage-gaps threshold) so the tracker can never disagree with the
   *  dashboard about what "thin" means. */
  target: number;
  /** Every material, including all-zero rows — "no signal at all" is a state
   *  the tracker renders, not an omission. */
  items: MaterialCoverageItem[];
}

export interface OperationalSubtype {
  value: string;
  label: string;
  default_severity: number;
}

export interface DuplicateHints {
  checked: boolean;
  reason: string | null;
  hints: Array<Record<string, unknown>>;
}

export interface TriageListParams {
  page?: number;
  limit?: number;
  status?: TriageStatus | "";
  search?: string;
  source?: string;
  pillar?: string;
  direction?: string;
  event_type?: string;
  severity_min?: number;
  material?: string;
  /** Geography code (countries.iso2); matches primary and secondary alike. */
  country?: string;
  /** Exactly one defect code. */
  defect?: string;
  /** Any defect at all — orthogonal to ``defect``, both may be sent. */
  has_defects?: boolean;
  /** Only events carrying at least one data-quality note. */
  flagged?: boolean;
  sort?: "event_date" | "severity_score" | "triage_status";
  sort_dir?: "asc" | "desc";
}

/** Per-source human-decision outcomes — GET /triage/stats (plan §7). */
export interface TriageSourceStats {
  source: string;
  pending: number;
  machine_display_only: number;
  human_decisions: number;
  scoring: number;
  display_only: number;
  rejected: number;
  category_confirmed: number;
  category_corrected: number;
  correction_rate: number | null;
}

/** Material-link suggestion quality per (source × match_reason). */
export interface TriageLinkQualityStats {
  source: string;
  match_reason: string;
  confirmed: number;
  rejected: number;
  untouched: number;
  decided: number;
  confirm_rate: number | null;
}

export interface TriageStats {
  generated_at: string;
  human_decisions_total: number;
  /** Rates on fewer decisions than this get a small-sample caution. */
  small_sample_threshold: number;
  sources: TriageSourceStats[];
  link_quality: TriageLinkQualityStats[];
}

const BASE = "/api/v1/triage";

export async function getTriageSummary(client: ApiClient): Promise<TriageSummary> {
  const { data } = await client.get<TriageSummary>(`${BASE}/summary`);
  return data;
}

export async function getTriageStats(client: ApiClient): Promise<TriageStats> {
  const { data } = await client.get<TriageStats>(`${BASE}/stats`);
  return data;
}

export async function getMaterialCoverage(
  client: ApiClient,
): Promise<MaterialCoverage> {
  const { data } = await client.get<MaterialCoverage>(`${BASE}/coverage`);
  return data;
}

export async function getTriageEvents(
  client: ApiClient,
  params: TriageListParams = {},
): Promise<TriageEventList> {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v != null),
  );
  const { data } = await client.get<TriageEventList>(`${BASE}/events`, {
    params: clean,
  });
  return data;
}

export async function getTriageEvent(
  client: ApiClient,
  id: number,
): Promise<TriageEvent> {
  const { data } = await client.get<TriageEvent>(`${BASE}/events/${id}`);
  return data;
}

export async function setTriageStatus(
  client: ApiClient,
  id: number,
  status: TriageStatus,
  primaryCategory?: string,
): Promise<TriageEvent> {
  const { data } = await client.patch<TriageEvent>(`${BASE}/events/${id}/status`, {
    status,
    primary_category: primaryCategory ?? null,
  });
  return data;
}

export async function setPrimaryCategory(
  client: ApiClient,
  id: number,
  primaryCategory: string,
): Promise<TriageEvent> {
  const { data } = await client.patch<TriageEvent>(`${BASE}/events/${id}/category`, {
    primary_category: primaryCategory,
  });
  return data;
}

export async function acceptSuggestions(
  client: ApiClient,
  id: number,
): Promise<TriageEvent> {
  const { data } = await client.post<TriageEvent>(`${BASE}/events/${id}/accept`);
  return data;
}

export async function promoteOperational(
  client: ApiClient,
  id: number,
  body: { subtype: string; severity?: number; note?: string; facility_name?: string },
): Promise<TriageEvent> {
  const { data } = await client.post<TriageEvent>(
    `${BASE}/events/${id}/promote-operational`,
    body,
  );
  return data;
}

export async function setLinkStatus(
  client: ApiClient,
  linkId: number,
  status: LinkStatus,
): Promise<TriageLink> {
  const { data } = await client.patch<TriageLink>(`${BASE}/links/${linkId}`, {
    status,
  });
  return data;
}

export async function addMaterialLink(
  client: ApiClient,
  eventId: number,
  materialId: number,
): Promise<TriageLink> {
  const { data } = await client.post<TriageLink>(`${BASE}/events/${eventId}/links`, {
    material_id: materialId,
  });
  return data;
}

export async function flagEvent(
  client: ApiClient,
  id: number,
  body: { note_type?: string; note_text: string },
): Promise<TriageEvent> {
  const { data } = await client.post<TriageEvent>(`${BASE}/events/${id}/flags`, body);
  return data;
}

export async function getDuplicateHints(
  client: ApiClient,
  id: number,
): Promise<DuplicateHints> {
  const { data } = await client.get<DuplicateHints>(
    `${BASE}/events/${id}/duplicate-hints`,
  );
  return data;
}

export async function getOperationalSubtypes(
  client: ApiClient,
): Promise<OperationalSubtype[]> {
  const { data } = await client.get<OperationalSubtype[]>(
    `${BASE}/operational-subtypes`,
  );
  return data;
}
