"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/platform/page-layout";
import { PlatformCard, PlatformCardHeader, PlatformCardBody } from "@/components/platform/platform-card";
import { ScoreChip } from "@/components/platform/score-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountrySharePill } from "@/components/shared/country-share-pill";
import { EntityFlagIssueDialog } from "@/components/shared/entity-flag-issue-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { VerifyToggleButton } from "@/components/shared/verify-toggle-button";
import { PlatformTable } from "@/components/platform/platform-table";
import { HsMappingsCard } from "@/components/materials/hs-mappings-card";
import { RiskEventsTab } from "@/components/materials/risk-events-tab";
import {
  useMaterial,
  useMaterialGlobalScore,
  useMaterialMarketScores,
  useMaterialMarketScoreDetail,
  useMaterialMarketScoreEvidence,
  materialQueryKeys,
} from "@/lib/hooks/use-materials";
import { useToggleMaterialVerified } from "@/lib/hooks/use-verified";
import { useEntityNotes } from "@/lib/hooks/use-entity-notes";
import {
  buildMarketRiskScoreColumns,
  sortCountryScoresByWeightedExposure,
} from "@/lib/table/market-risk-score-columns";
// HsCodesAndStagesTab import preserved (commented) so re-enabling the tab
// after partner facility data lands is a one-line change.
// import {
//   HsCodesAndStagesTab,
//   type HsMappingNode,
// } from "@/components/materials/hs-codes-stages-tab";
import type {
  EvidenceFacilityItem,
  EvidenceRegulationItem,
  EvidenceRiskEventItem,
  MaterialGeographyScoreRead,
  MaterialGlobalScoreRead,
} from "@/lib/types";
import { formatDate, formatDateTime, formatRelative, humanize, NOTE_TYPE_BADGE, NOTE_TYPE_LABEL } from "@/lib/utils/format";
import { useBreadcrumbLabel } from "@/components/platform/breadcrumb-context";

// MVP detail-page layout (2026-05-09): three top-level tabs only.
//
// What was removed:
//   - "HS Codes & Stages" — the data is too thin pre-G4c facility seed
//     to be the front door (HS-node scoring covers the ore stage well
//     but not refined / intermediate / battery_grade for most materials).
//     Component file kept intact in components/materials/ so re-enabling
//     is a one-line change once partner facility data lands.
//   - "Notes" tab — folded into a collapsible at the bottom of Overview
//     so analyst notes stay accessible without taking a tab slot.
//
// What replaced them:
//   - "Risk events" — placeholder card pointing at the global risk-events
//     page until the per-material events feed (with material_id filter
//     + free-text search) ships.
const TABS = [
  { value: "overview", label: "Overview" },
  { value: "scores", label: "Country scores" },
  { value: "events", label: "Risk events" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: material, isLoading, error, refetch } = useMaterial(id);
  const { data: globalScore = null } = useMaterialGlobalScore(id);
  const { data: marketScores = [] } = useMaterialMarketScores(id);
  const [tab, setTab] = useState<TabValue>("overview");

  // Register the material name so the breadcrumb shows "Lithium" instead of "42"
  useBreadcrumbLabel(id, material?.canonical_name);

  const verifyMutation = useToggleMaterialVerified({
    invalidateKeys: [[...materialQueryKeys.detail(id)]],
  });

  if (isLoading) {
    return (
      <PageLayout>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageLayout>
    );
  }

  if (error || !material) {
    return (
      <PageLayout>
        <ErrorState
          error={error ?? new Error("Material not found")}
          onRetry={() => refetch()}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/data/materials">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Materials
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <VerifyToggleButton
            verified={material.verified}
            disabled={verifyMutation.isPending}
            unmarkLabel="Verified"
            highlightWhenVerified
            onToggle={() =>
              verifyMutation.mutate({
                materialId: material.id,
                verified: !material.verified,
              })
            }
          />
          <EntityFlagIssueDialog
            entityType="material"
            entityId={String(material.id)}
            entityLabel={material.canonical_name}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {material.canonical_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{humanize(material.category)}</span>
              {material.is_ira_critical_mineral && (
                <Badge
                  variant="outline"
                  className="border-0 bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                >
                  IRA critical
                </Badge>
              )}
              {material.is_eu_crma_critical && (
                <Badge
                  variant="outline"
                  className="border-0 bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200"
                >
                  EU CRMA
                </Badge>
              )}
              {material.data_availability && (
                <span>· data: {material.data_availability}</span>
              )}
            </div>
          </div>
          {globalScore && (
            <div className="shrink-0 text-right">
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                Structural Supply Risk
              </div>
              {/* 5.0 cutover: overall == concentration pillar. A null
                  overall now means the concentration pillar is unscored
                  (insufficient data) — never fall through to a blank. */}
              <ScoreChip
                score={globalScore.overall_risk_score}
                showBandLabel
                insufficientData={globalScore.overall_risk_score == null}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tab bar — platform CSS underline style */}
      <div className="p-tabs">
        {TABS.map((t) => {
          const count =
            t.value === "scores" ? marketScores.length : null;
          return (
            <button
              key={t.value}
              className={`p-tab${tab === t.value ? " active" : ""}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              {count != null && count > 0 && (
                <span className="p-tab-count">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === "overview" && (
          <OverviewTab
            materialId={String(material.id)}
            material={material}
            globalScore={globalScore}
          />
        )}
        {tab === "scores" && <ScoresTab materialId={String(material.id)} scores={marketScores} />}
        {tab === "events" && (
          <RiskEventsTab
            materialId={id}
            materialName={material.canonical_name}
          />
        )}
      </div>
    </PageLayout>
  );
}

interface OverviewTabProps {
  materialId: string;
  material: import("@/lib/types").MaterialDetail;
  globalScore: MaterialGlobalScoreRead | null;
}

// Risk-score trend (latest MaterialGlobalRiskScore.overall vs the most
// recent snapshot at least 7 days older).  Rising = composite score
// went UP → risk increased → red.  Declining = composite score went
// DOWN → risk improved → green.  Stable = moved by ≤5 points →
// neutral gray (not amber — "stable" doesn't warrant a warning color
// when the underlying signal is the actual score, not event count).
const TREND_CONFIG: Record<string, { label: string; arrow: string; color: string }> = {
  rising: {
    label: "Rising",
    arrow: "↗",
    color: "text-red-600 dark:text-red-400",
  },
  stable: {
    label: "Stable",
    arrow: "→",
    color: "text-muted-foreground",
  },
  declining: {
    label: "Declining",
    arrow: "↘",
    color: "text-emerald-600 dark:text-emerald-400",
  },
};

function OverviewTab({ materialId, material, globalScore }: OverviewTabProps) {
  // 2026-05-11: trend now sourced from score_trend_7d (computed by the
  // /materials/{id} route from the MaterialGlobalRiskScore time series).
  // Previously experimented with event-count trend, but the user
  // correctly flagged that more events doesn't mean more risk (e.g.,
  // IEA INVESTMENT_PLEDGE events are constructive signals).  Score-
  // trend answers the actual analyst question semantically.
  const trend = material.score_trend_7d
    ? TREND_CONFIG[material.score_trend_7d]
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* ── Global risk score — first so it's immediately visible ── */}
      {globalScore && (
        <GlobalScoreCard score={globalScore} className="md:col-span-3" />
      )}

      {/* ── Material profile ── */}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Material profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {material.symbol_or_code && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Symbol / code
                </div>
                <span className="font-mono text-lg font-semibold">
                  {material.symbol_or_code}
                </span>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Category
              </div>
              <span className="text-sm">{humanize(material.category) || "—"}</span>
            </div>
            {/* "Data availability" and "Price basis" tiles retired
                2026-05-11 — both were internal scoring metadata that
                aren't analyst-actionable as standalone fields and were
                "—" for most materials anyway (the seed never sets them
                for the bulk of the launch list).  Backend response
                still carries both for backwards-compat. */}

            <div>
              <div
                className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1"
                title={
                  "Composite risk-score movement.  Compares the latest " +
                  "global score to the most recent snapshot at least 7 " +
                  "days older (max 30-day lookback).  ±5-point threshold " +
                  "on the 0-100 scale.  Rising = risk increased; " +
                  "declining = risk improved."
                }
              >
                Risk trend (7d)
              </div>
              {trend ? (
                <span className={`text-sm font-medium ${trend.color}`}>
                  {trend.arrow} {trend.label}
                </span>
              ) : (
                <span
                  className="text-sm text-muted-foreground"
                  title="No prior score snapshot at least 7 days older available (insufficient scoring history).  Will populate once scoring has been running for ≥1 week."
                >
                  —
                </span>
              )}
            </div>

            {/* 2026-05-11 analyst-view stats — recent event volume and
                facility coverage.  Both anchor whether the score behind
                this material is built on credible data. */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Risk events (90d)
              </div>
              <span
                className="font-mono text-sm font-semibold tabular-nums"
                style={{
                  color:
                    (material.recent_event_count_90d ?? 0) >= 5
                      ? "var(--p-text)"
                      : "var(--p-text-muted)",
                }}
                title="Events in the last 90 days mapped to this material via RiskEventMaterial.  Matches the dashboard Coverage Gaps threshold."
              >
                {material.recent_event_count_90d ?? 0}
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Facilities tracked
              </div>
              <span
                className="font-mono text-sm font-semibold tabular-nums"
                style={{
                  color:
                    (material.facility_count ?? 0) > 0
                      ? "var(--p-text)"
                      : "var(--p-risk-crit)",
                }}
                title="FacilityMaterialLink rows for this material.  Drives the operational pillar's structural input.  0 = launch-blocker for that pillar."
              >
                {material.facility_count ?? 0}
              </span>
            </div>
            {(material.country_production_shares.length > 0 ||
              (material.primary_producing_countries ?? []).length > 0) && (
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Primary producing countries
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {material.country_production_shares.length > 0
                    ? material.country_production_shares.map((c) => (
                        <CountrySharePill key={c.code} code={c.code} sharePct={c.share_pct} />
                      ))
                    : (material.primary_producing_countries ?? []).map((cc) => (
                        <CountrySharePill key={cc} code={cc} />
                      ))}
                </div>
              </div>
            )}
            {material.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Analyst notes
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {material.notes}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── HS code mappings — the partner's accuracy-review surface.
          Lives between Material profile and Found in batteries because
          the HS codes drive trade-event attribution (which feeds the
          score above), so the analyst flow reads: score → material
          identity → HS codes feeding the score → battery chemistry use. */}
      <HsMappingsCard mappings={material.hs_code_mappings ?? []} />

      {/* ── Found in batteries ── */}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Found in batteries</CardTitle>
        </CardHeader>
        <CardContent>
          {material.chemistry_uses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not used by any catalogued battery chemistry.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {material.chemistry_uses.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium leading-tight">
                        {u.chemistry_name ? u.chemistry_name.split(" ")[0] : u.chemistry_slug?.toUpperCase() ?? `#${u.battery_chemistry_id}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {humanize(u.role)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span
                        style={{
                          fontFamily: "var(--p-font-mono)",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--p-text)",
                        }}
                      >
                        {u.intensity.toFixed(2)}
                      </span>
                      {u.is_substitutable && (
                        <span style={{ fontSize: 10, color: "var(--p-text-faint)" }}>
                          substitutable
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Intensity is the relative material weight fraction within each chemistry formulation (0–1 scale; values above 1 indicate a data entry issue in the source).
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Analyst notes — folded into Overview as a collapsible section
          (May 2026 strip-down).  Used to live in its own tab.  Most
          materials have zero notes today; collapsing it by default keeps
          Overview clean while still reachable in one click. */}
      <div className="md:col-span-3">
        <NotesSection materialId={materialId} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes section — collapsible in Overview (replaces the old top-level tab)
// ---------------------------------------------------------------------------

function NotesSection({ materialId }: { materialId: string }) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useEntityNotes("material", materialId);

  // Hide entirely if we're not loading and there are no notes — no point
  // showing a "0 notes" affordance for the steady state.
  if (!isLoading && data.length === 0) return null;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={() => setOpen((v) => !v)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <span>Analyst notes ({data.length})</span>
          <span className="text-xs font-normal text-muted-foreground">
            {open ? "Hide" : "Show"}
          </span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {data.map((note) => {
            const badgeClass = NOTE_TYPE_BADGE[note.note_type] ?? "p-badge-soft";
            const noteLabel = NOTE_TYPE_LABEL[note.note_type] ?? humanize(note.note_type);
            return (
              <div key={note.id} className="border-b border-border/60 pb-3 last:border-0">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`p-badge ${badgeClass}`}>{noteLabel}</span>
                  <span
                    className="ml-auto text-[11px] text-muted-foreground"
                    title={formatDateTime(note.created_at)}
                  >
                    {formatRelative(note.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {note.note_text}
                </p>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

interface GlobalScoreCardProps {
  score: MaterialGlobalScoreRead;
  className?: string;
}

const GLOBAL_PILLARS: {
  key: keyof MaterialGlobalScoreRead;
  label: string;
  pillarClass: string;
  colorVar: string;
  /** 5.0 concentration-first launch (2026-08-17): true = shadow-scored at
   *  weight 0 — computed + displayed for the validation record, does NOT
   *  move the published score. Rendered dimmed with an "in validation"
   *  note. Flip back per pillar as the D0 re-promotion gates clear
   *  (engine: MARKET_PILLAR_WEIGHTS). */
  inValidation?: boolean;
}[] = [
  {
    key: "material_concentration_score",
    label: "Mat. Concentration",
    pillarClass: "p-pillar-material",
    colorVar: "var(--p-pillar-material)",
  },
  {
    key: "geopolitical_trade_score",
    label: "Geopolitical",
    pillarClass: "p-pillar-geo",
    colorVar: "var(--p-pillar-geo)",
    inValidation: true,
  },
  {
    key: "regulatory_compliance_score",
    label: "Regulatory",
    pillarClass: "p-pillar-regulatory",
    colorVar: "var(--p-pillar-regulatory)",
    inValidation: true,
  },
  {
    key: "operational_score",
    label: "Operational",
    pillarClass: "p-pillar-operational",
    colorVar: "var(--p-pillar-operational)",
    inValidation: true,
  },
  {
    key: "financial_pressure_score",
    label: "Financial Pressure",
    pillarClass: "p-pillar-financial",
    colorVar: "var(--p-pillar-financial)",
    inValidation: true,
  },
];

function GlobalScoreCard({ score, className }: GlobalScoreCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Structural supply risk</CardTitle>
        <div className="text-xs text-muted-foreground">
          {score.trade_weighted_geo_count} geograph
          {score.trade_weighted_geo_count === 1 ? "y" : "ies"} weighted · as of{" "}
          {formatDate(score.as_of_date)}
        </div>
      </CardHeader>
      <CardContent>
        {/* Uses platform CSS: p-score-grid, p-score-cell, p-score-cell-label,
            p-score-cell-value, p-pillar-strip + p-pillar-* colour classes */}
        <div className="p-score-grid">
          {/* Published score — highlighted cell.  5.0: equals the
              Material Concentration pillar exactly (concentration-first
              launch); shown as its own cell so the equality is visible
              rather than implied. */}
          <div className="p-score-cell overall">
            <div className="p-score-cell-label">Structural Supply Risk</div>
            <div className="p-score-cell-value">
              {score.overall_risk_score != null
                ? score.overall_risk_score.toFixed(1)
                : "—"}
            </div>
            {/* Neutral bar for overall */}
            <div
              className="p-pillar-strip"
              style={{ background: "var(--p-accent)", opacity: 0.6 }}
            />
          </div>

          {/* One cell per pillar — shadow-scored pillars render dimmed */}
          {GLOBAL_PILLARS.map((p) => {
            const raw = score[p.key] as number | null | undefined;
            return (
              <div
                key={p.key}
                className={`p-score-cell${p.inValidation ? " opacity-55" : ""}`}
                title={
                  p.inValidation
                    ? "Signal in validation — computed and recorded, weight 0 in the published score until it clears the re-promotion quality gates."
                    : undefined
                }
              >
                <div className="p-score-cell-label">
                  {p.label}
                  {p.inValidation && (
                    <span className="ml-1 align-middle text-[9px] font-normal uppercase tracking-wide text-muted-foreground">
                      · validating
                    </span>
                  )}
                </div>
                <div className="p-score-cell-value">
                  {raw != null ? Math.round(raw) : "—"}
                </div>
                <div className={`p-pillar-strip ${p.pillarClass}`} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The published score is the Material Concentration pillar
          (structural supply risk). Geopolitical, Regulatory, Operational
          and Financial are signals in validation — shadow-scored at weight
          0 while the triaged event baseline accumulates; they re-enter the
          published score per pillar once the quality gates are met.
        </p>
      </CardContent>
    </Card>
  );
}

// `Stat` (small KPI helper) was removed in May 2026 along with
// MappingHealthCard.  If a future Overview card needs a stat tile, the
// platform CSS (.p-card-body grid) covers it without a dedicated
// component — see GlobalScoreCard above for the pattern.

// HsCodesAndStagesTab replaces the old MappingsTab — see
// components/materials/hs-codes-stages-tab.tsx.  Old flat-list
// view is preserved via the "Flat list" toggle inside that tab.

// ---------------------------------------------------------------------------
// Scores tab
// ---------------------------------------------------------------------------

interface ScoresTabProps {
  materialId: string;
  scores: MaterialGeographyScoreRead[];
}

// Country-scores display strategy (2026-06 revision — reframe by weighted
// exposure):
// Switched the default sort from "producer share, then overall risk" to
// "weighted exposure (share × overall risk) desc".  This surfaces the
// countries that contribute the most to a buyer's risk picture instead
// of leading with whichever country happens to have the largest production
// share regardless of how risky that share is.
//
// Also narrowed the visible pillar columns to (Geopolitical, Regulatory,
// Operational) — Material Concentration and Financial Pressure are
// computed at the material level, not per-country, so showing them per
// row implied country-specific signal that doesn't exist.  Material-level
// pillar values still appear in the Global score card above the table.
//
// Default top-N reduced 15 → 10 since the new sort surfaces the truly
// load-bearing countries first; the tail rarely matters.
const COUNTRY_SCORES_DEFAULT_LIMIT = 10;

/**
 * Pillars to show in the per-country table.  Material Concentration and
 * Financial Pressure don't vary by country and are misleading per-row —
 * they're surfaced in the Global score card at the top of the page.
 */
const COUNTRY_VIEW_PILLARS = [
  "geopolitical_trade_score",
  "regulatory_compliance_score",
  "operational_score",
] as const;

function ScoresTab({ materialId, scores }: ScoresTabProps) {
  const [expandedGeo, setExpandedGeo] = useState<string | null>(null);
  const [showAllCountries, setShowAllCountries] = useState(false);

  const columns = useMemo(
    () =>
      buildMarketRiskScoreColumns({
        showMaterialColumn: false,
        overallBandLabels: false,
        showExposureColumns: true,
        showWeightedRisk: true,
        pillarsToShow: [...COUNTRY_VIEW_PILLARS],
      }),
    [],
  );

  const sortedData = useMemo(
    () => sortCountryScoresByWeightedExposure(scores),
    [scores],
  );

  const visibleData = showAllCountries
    ? sortedData
    : sortedData.slice(0, COUNTRY_SCORES_DEFAULT_LIMIT);

  function handleRowClick(row: MaterialGeographyScoreRead) {
    setExpandedGeo((prev) =>
      prev === row.geography_code ? null : row.geography_code,
    );
  }

  if (scores.length === 0) {
    return (
      <PlatformCard>
        <PlatformCardHeader
          title="Country-level risk scores"
          subtitle="Sorted by weighted exposure (share × overall risk) desc"
        />
        <PlatformCardBody>
          <p style={{ fontSize: 13, color: "var(--p-text-muted)", textAlign: "center", padding: "24px 0" }}>
            No market scores have been computed for this material yet.
          </p>
        </PlatformCardBody>
      </PlatformCard>
    );
  }

  const cappedLimit = Math.min(COUNTRY_SCORES_DEFAULT_LIMIT, sortedData.length);
  // 5.0 note appended: the per-country pillar columns (Geopolitical /
  // Regulatory / Operational) are shadow-scored signals in validation —
  // they do not feed the published score.
  const subtitle = showAllCountries
    ? `Showing all ${sortedData.length} scored countries · sorted by weighted exposure (share × overall risk) · click a row to drill in · event-pillar columns are signals in validation (weight 0)`
    : `Showing top ${cappedLimit} of ${sortedData.length} by weighted exposure (share × overall risk) · click a row to drill in · toggle below to show all · event-pillar columns are signals in validation (weight 0)`;

  return (
    <PlatformCard>
      <PlatformCardHeader
        title="Country-level risk scores"
        subtitle={subtitle}
        actions={
          <label
            className="inline-flex items-center gap-2 text-[11px]"
            style={{ color: "var(--p-text-muted)", cursor: "pointer" }}
            title={`Default view shows top ${COUNTRY_SCORES_DEFAULT_LIMIT} countries ranked by production share then overall risk — toggle to see the full list of ${sortedData.length}`}
          >
            <input
              type="checkbox"
              checked={showAllCountries}
              onChange={(e) => setShowAllCountries(e.target.checked)}
              style={{ accentColor: "var(--p-accent)" }}
            />
            Show all countries
          </label>
        }
      />
      <PlatformCardBody noPadding>
        {visibleData.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--p-text-muted)", textAlign: "center", padding: "24px 16px" }}>
            No scored countries to display.
          </p>
        ) : (
          <PlatformTable
            embedded
            data={visibleData}
            columns={columns}
            onRowClick={handleRowClick}
            isRowExpanded={(row) => row.geography_code === expandedGeo}
            renderSubComponent={(row) => (
              <ScoreRationalePanel
                materialId={materialId}
                geoCode={row.geography_code}
              />
            )}
          />
        )}
      </PlatformCardBody>
    </PlatformCard>
  );
}

// ---------------------------------------------------------------------------
// Score rationale detail panel (rendered inside expanded table row)
// ---------------------------------------------------------------------------

interface ScoreRationalePanelProps {
  materialId: string;
  geoCode: string;
}

const PILLAR_META: {
  key: string;
  label: string;
  colorClass: string;
  inputs: { key: string; label: string }[];
}[] = [
  {
    key: "material",
    label: "Mat. Concentration",
    colorClass: "text-blue-600 dark:text-blue-400",
    inputs: [
      { key: "criticality", label: "Criticality" },
      { key: "concentration", label: "Concentration" },
      { key: "trade_volatility", label: "Trade volatility" },
      { key: "stage_rollup_method", label: "Rollup method" },
      { key: "stage_rollup_count", label: "Stage nodes" },
    ],
  },
  {
    key: "geopolitical",
    label: "Geopolitical",
    colorClass: "text-red-600 dark:text-red-400",
    inputs: [
      { key: "country_concentration", label: "Country conc." },
      { key: "export_restriction_exposure", label: "Export restrictions" },
      { key: "tariff_exposure", label: "Tariff exposure" },
    ],
  },
  {
    key: "regulatory",
    label: "Regulatory",
    colorClass: "text-violet-600 dark:text-violet-400",
    inputs: [
      { key: "top_event_count", label: "Top events" },
      { key: "scope_obligations", label: "Scope obligations" },
      { key: "policy_proximity_adjustment", label: "Policy proximity adj." },
    ],
  },
  {
    key: "operational",
    label: "Operational",
    colorClass: "text-amber-600 dark:text-amber-400",
    inputs: [
      { key: "structural_dependency", label: "Structural dependency" },
      { key: "structural_dependency_source", label: "Dependency source" },
      { key: "event_impact_count", label: "Impact events" },
    ],
  },
  {
    key: "financial_pressure",
    label: "Financial Pressure",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    inputs: [
      { key: "base_filing_signal", label: "Filing signal" },
      { key: "leverage_warning_bonus", label: "Leverage warning" },
      { key: "liquidity_stress_bonus", label: "Liquidity stress" },
      { key: "evidence_count", label: "Evidence items" },
    ],
  },
];

function formatSubValue(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "number") return val % 1 === 0 ? String(val) : val.toFixed(3);
  return String(val);
}

// Drop Mat. Concentration and Financial Pressure pillars from the
// sub-input drill-down for the same reason their columns were dropped
// from the table: they're computed at the material level and don't vary
// by country, so showing the same numbers under every country row is
// noise.  Material-level values still appear in the Global score card
// at the top of the page.
const COUNTRY_VARYING_PILLAR_KEYS = new Set([
  "geopolitical",
  "regulatory",
  "operational",
]);

function ScoreRationalePanel({ materialId, geoCode }: ScoreRationalePanelProps) {
  // Two parallel queries: evidence (regulations/facilities/risk events
  // at the strict material × country intersection) and rationale
  // (per-pillar sub-input numbers).  Evidence is the primary content;
  // sub-inputs render in a collapsible debug section below.
  const { data: evidence, isLoading: evidenceLoading } =
    useMaterialMarketScoreEvidence(materialId, geoCode);
  const { data: detail, isLoading: rationaleLoading } =
    useMaterialMarketScoreDetail(materialId, geoCode);
  const [subInputsOpen, setSubInputsOpen] = useState(false);

  if (evidenceLoading) {
    return (
      <div className="flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground">
        <Skeleton className="h-3 w-3 rounded-full" />
        Loading evidence…
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="px-5 py-4 text-xs text-muted-foreground">
        No evidence available for this score.
      </div>
    );
  }

  return (
    <div className="border-t border-border/50">
      {/* ── Evidence sections (regulations / facilities / risk events) ── */}
      <div className="space-y-3 px-4 py-3">
        <EvidenceSection
          title="Regulations"
          colorClass="text-violet-600 dark:text-violet-400"
          totalCount={evidence.regulation_total}
          shownCount={evidence.regulations.length}
          // Explicit empty-state copy (not "0 regulations") — distinguishes
          // "we checked and there are none for this pair" from "we have no
          // data here", which matters for partner-curated tables like
          // regulation_material_scope.
          emptyCopy="No regulations curated for this material × country yet."
        >
          {evidence.regulations.map((r) => (
            <EvidenceRegulationRow key={r.id} reg={r} />
          ))}
        </EvidenceSection>

        <EvidenceSection
          title="Facilities"
          colorClass="text-amber-600 dark:text-amber-400"
          totalCount={evidence.facility_total}
          shownCount={evidence.facilities.length}
          emptyCopy="No facilities curated for this material × country yet."
        >
          {evidence.facilities.map((f) => (
            <EvidenceFacilityRow key={f.id} facility={f} />
          ))}
        </EvidenceSection>

        <EvidenceSection
          title="Risk events"
          colorClass="text-red-600 dark:text-red-400"
          totalCount={evidence.risk_event_total}
          shownCount={evidence.risk_events.length}
          emptyCopy={`No risk events at the (material × country) intersection in the last ${evidence.risk_event_window_days} days.`}
          windowDays={evidence.risk_event_window_days}
        >
          {evidence.risk_events.map((e) => (
            <EvidenceRiskEventRow key={e.id} event={e} />
          ))}
        </EvidenceSection>
      </div>

      {/* ── Score breakdown (sub-input numbers) — collapsed by default ── */}
      <div className="border-t border-border/50">
        <button
          type="button"
          onClick={() => setSubInputsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40 transition-colors"
          aria-expanded={subInputsOpen}
        >
          <span>{subInputsOpen ? "Hide" : "Show"} score breakdown</span>
          <span className="font-normal normal-case tracking-normal text-[11px]">
            {rationaleLoading
              ? "…"
              : detail?.rationale_json?.sub_inputs
                ? "diagnostic sub-inputs"
                : "no rationale data"}
          </span>
        </button>
        {subInputsOpen && (
          <ScoreSubInputsPanel
            subInputs={detail?.rationale_json?.sub_inputs}
            loading={rationaleLoading}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence section + row components
// ---------------------------------------------------------------------------

interface EvidenceSectionProps {
  title: string;
  colorClass: string;
  totalCount: number;
  shownCount: number;
  emptyCopy: string;
  windowDays?: number;
  children: React.ReactNode;
}

function EvidenceSection({
  title,
  colorClass,
  totalCount,
  shownCount,
  emptyCopy,
  children,
}: EvidenceSectionProps) {
  const truncated = totalCount > shownCount;
  return (
    <section className="space-y-1.5">
      <header className="flex items-baseline justify-between gap-3">
        <h4 className={`text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
          {title}
        </h4>
        {totalCount > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {truncated ? `${shownCount} of ${totalCount}` : `${totalCount}`}
          </span>
        )}
      </header>
      {totalCount === 0 ? (
        <p className="text-[11px] italic text-muted-foreground/80">{emptyCopy}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </section>
  );
}

function EvidenceRegulationRow({ reg }: { reg: EvidenceRegulationItem }) {
  // Use the material_scope_type to colour the chip — banned/restricted are
  // signal-heavy, covered/disclosure_required are baseline.
  const scopeColor =
    reg.material_scope_type === "banned"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
      : reg.material_scope_type === "restricted"
        ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800"
        : "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex items-start gap-3 text-[11px]">
      <span
        className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[9.5px] font-mono font-semibold tabular-nums ${scopeColor}`}
        title={`material scope: ${reg.material_scope_type} · geography scope: ${reg.geography_scope_type}`}
      >
        {reg.material_scope_type}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[10px] text-muted-foreground">
            {reg.regulation_key}
          </span>
          <span className="text-foreground">
            {reg.title || "(no title)"}
          </span>
        </div>
        {(reg.status || reg.effective_date) && (
          <div className="text-[10px] text-muted-foreground">
            {reg.status}
            {reg.effective_date && reg.status ? " · " : ""}
            {reg.effective_date && `effective ${reg.effective_date}`}
            {reg.geography_compliance_weight != null && (
              <>
                {" · "}
                geo weight {reg.geography_compliance_weight.toFixed(2)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceFacilityRow({
  facility: f,
}: {
  facility: EvidenceFacilityItem;
}) {
  const statusColor =
    f.status === "operating"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
      : f.status === "planned" || f.status === "under_construction"
        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800"
        : "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex items-start gap-3 text-[11px]">
      <span
        className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[9.5px] font-mono font-semibold ${statusColor}`}
      >
        {f.status}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-foreground">{f.name || "(unnamed facility)"}</span>
          <span className="text-[10px] text-muted-foreground">
            {f.facility_type}
            {f.supply_chain_stage && ` · ${f.supply_chain_stage}`}
            {!f.is_primary_product && " · co-product"}
          </span>
        </div>
        {(f.region || f.city || f.annual_capacity_tpy != null) && (
          <div className="text-[10px] text-muted-foreground">
            {[f.city, f.region].filter(Boolean).join(", ")}
            {f.annual_capacity_tpy != null && (
              <>
                {f.city || f.region ? " · " : ""}
                {f.annual_capacity_tpy.toLocaleString()} t/yr
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceRiskEventRow({
  event: e,
}: {
  event: EvidenceRiskEventItem;
}) {
  // Color severity chip on a 4-band scale to match the rest of the platform.
  const sev = e.severity_score ?? 0;
  const sevColor =
    sev >= 0.75
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
      : sev >= 0.55
        ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800"
        : sev >= 0.35
          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
          : "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex items-start gap-3 text-[11px]">
      <span
        className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[9.5px] font-mono font-semibold tabular-nums ${sevColor}`}
        title={`severity score (0.0–1.0)`}
      >
        {sev.toFixed(2)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-foreground">{e.title}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          <span className="font-mono">{e.event_type}</span>
          {e.event_subtype && (
            <>
              {" · "}
              <span className="font-mono">{e.event_subtype}</span>
            </>
          )}
          {e.event_date && ` · ${e.event_date.slice(0, 10)}`}
          {e.source_system && ` · ${e.source_system}`}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score sub-inputs panel (collapsed-by-default diagnostic view)
// ---------------------------------------------------------------------------

interface ScoreSubInputsPanelProps {
  // Loose dict — rationale_json shape is documented in MaterialGeographyScoreDetail.
  subInputs:
    | Record<string, Record<string, unknown> | undefined>
    | null
    | undefined;
  loading: boolean;
}

function ScoreSubInputsPanel({ subInputs, loading }: ScoreSubInputsPanelProps) {
  if (loading) {
    return (
      <div className="px-4 py-2 text-[11px] text-muted-foreground">
        Loading sub-inputs…
      </div>
    );
  }
  if (!subInputs) {
    return (
      <div className="px-4 py-2 text-[11px] text-muted-foreground">
        No rationale data for this score.
      </div>
    );
  }
  const visiblePillars = PILLAR_META.filter((p) =>
    COUNTRY_VARYING_PILLAR_KEYS.has(p.key),
  );
  return (
    <div className="px-4 py-2">
      <dl className="divide-y divide-border/40">
        {visiblePillars.map((pillar) => {
          const inputs = subInputs[pillar.key] ?? {};
          return (
            <div
              key={pillar.key}
              className="flex items-start gap-4 py-1.5 text-[10.5px]"
            >
              <dt
                className={`shrink-0 w-36 pt-0.5 text-[9.5px] font-bold uppercase tracking-wider ${pillar.colorClass}`}
              >
                {pillar.label}
              </dt>
              <dd className="flex flex-1 flex-wrap gap-x-4 gap-y-0.5">
                {pillar.inputs.map(({ key, label }) => {
                  const val = (inputs as Record<string, unknown>)[key];
                  return (
                    <div key={key} className="flex gap-1.5 min-w-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-semibold text-foreground break-all">
                        {formatSubValue(val)}
                      </span>
                    </div>
                  );
                })}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

// NotesTab was removed in the May 2026 strip-down — analyst notes now
// render inside Overview as a collapsible (see ``NotesSection`` above).
