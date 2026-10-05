/**
 * Supply Concentration transparency API client.
 *
 * Mirrors app/api/routes/concentration.py exactly; if a field is added there,
 * add it here. This surface is read-only — the pillar is data-derived, there
 * are no events and no writes.
 */

import type { ApiClient } from "./client";

export type AuditState = "fresh" | "stale" | "understated" | "nostage";

export interface StageDetail {
  stage: string;
  reference_year: number;
  source: string | null;
  hhi_raw: number;
  hhi_cliff: number;
  fresh: boolean;
  age_years: number;
  /** country → share for the stage's single-vintage snapshot. */
  shares: Record<string, number>;
  conflicts: string[];
}

export interface StaleBest {
  stage: string;
  reference_year: number;
  score: number;
}

export interface GeoResult {
  /** Pre-amplifier stage-max — understatement comparisons use this, matching
   *  the engine, which amplifies only the final max. */
  raw_score: number;
  score: number;
  binding_stage: string | null;
  sub_scores: Record<string, number>;
  wgi_pct: number | null;
  instability: number | null;
  amplified: boolean;
  stale_best: StaleBest | null;
  understated: boolean;
}

export interface Producer {
  /** Stage this row belongs to (2026-08-05): detail producers are per-stage
   *  snapshots — shares are within-stage fractions and must never be summed
   *  across stages. Null on overview top_production rows (single-stream
   *  material_production_shares). */
  stage: string | null;
  country_code: string;
  production_share: number;
  production_volume: number | null;
  reference_year: number;
  unit_of_measure: string | null;
  source: string | null;
}

export interface CapacityRow {
  detail_type: string;
  country_code: string;
  capacity_share: number | null;
  capacity_volume: number | null;
  reference_year: number;
}

/** Retired from the pillar under V1 stage-max — served as labelled context. */
export interface CriticalityContext {
  source: string | null;
  reference_year: number | null;
  hhi_score: number | null;
  reserve_hhi_score: number | null;
  reserve_life_index: number | null;
  capacity_utilization: number | null;
  production_yoy_pct: number | null;
}

export interface PriorOreHhi {
  reference_year: number;
  hhi_raw: number;
}

export interface MaterialConcentrationDetail {
  material_id: number;
  name: string;
  symbol: string | null;
  is_launch_list: boolean;
  unit: string | null;
  as_of: string;
  freshness_years: number;
  governance_beta: number;
  wgi_vintage: number | null;
  stages: StageDetail[];
  per_geo: Record<string, GeoResult>;
  driving_geo: string | null;
  headline_understated: boolean;
  producers: Producer[];
  capacity: CapacityRow[];
  criticality: CriticalityContext | null;
  prior_ore_hhi: PriorOreHhi | null;
  country_names: Record<string, string>;
}

export interface OverviewOre {
  hhi_raw: number;
  hhi_cliff: number;
  reference_year: number;
  fresh: boolean;
}

export interface OverviewRow {
  material_id: number;
  name: string;
  symbol: string | null;
  is_launch_list: boolean;
  audit_state: AuditState;
  driving_geo: string | null;
  score: number | null;
  binding_stage: string | null;
  binding_year: number | null;
  ore: OverviewOre | null;
  prior_ore_hhi: PriorOreHhi | null;
  stale_stages: StaleBest[];
  understated_geo_count: number;
  reserve_life_index: number | null;
  top_production: Producer[];
}

/** Launch-list freshness tally — the Workstream A readout. */
export interface AuditTally {
  fully_fresh: number;
  with_stale: number;
  understated: number;
  no_stage: number;
}

export interface Uncovered {
  material_id: number;
  name: string;
  symbol: string | null;
}

export interface ConcentrationOverview {
  as_of: string;
  freshness_years: number;
  governance_beta: number;
  wgi_vintage: number | null;
  audit: AuditTally;
  items: OverviewRow[];
  uncovered: Uncovered[];
  country_names: Record<string, string>;
}

const BASE = "/api/v1/concentration";

export async function getConcentrationOverview(
  client: ApiClient,
  asOf?: string,
): Promise<ConcentrationOverview> {
  const { data } = await client.get<ConcentrationOverview>(`${BASE}/overview`, {
    params: asOf ? { as_of: asOf } : undefined,
  });
  return data;
}

export async function getConcentrationDetail(
  client: ApiClient,
  materialId: number,
  asOf?: string,
): Promise<MaterialConcentrationDetail> {
  const { data } = await client.get<MaterialConcentrationDetail>(
    `${BASE}/materials/${materialId}`,
    { params: asOf ? { as_of: asOf } : undefined },
  );
  return data;
}
