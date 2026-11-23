"use client";

import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EVENT_SCORE_CAP,
  OBLIGATION_SCORE_CAP,
  countryName,
  humanizeMaterialScope,
  humanizeRegulationStatus,
  materialDisplayName,
  materialScopeWeight,
} from "@/lib/utils/regulations";
import type {
  RegulationDetail,
  RegulationGeographyScopeRead,
  RegulationMaterialScopeRead,
} from "@/lib/types";

interface ScoringImpactPanelProps {
  regulation: RegulationDetail;
  materialNameById?: Record<number, string>;
  className?: string;
}

/**
 * Surfaces every scoring-relevant input this regulation drives so partner
 * reviewers can validate the configuration produces the intended impact.
 *
 * Sections:
 *   1. Activation gate     — verified flag + filtering effect
 *   2. Pillar contributions — what the regulation feeds at each level
 *   3. Per-event severity   — Level-1 event chain (status × proximity × scope × geo)
 *   4. Material scope weights — per-material weight at scoring time
 *   5. Geography scope      — jurisdiction / targeted / origin (flat 0.50 today)
 *   6. Company-level uplift — Level-4 obligation × compliance status matrix
 *
 * Designed to be read top-to-bottom as a partner review checklist.
 */
export function ScoringImpactPanel({
  regulation,
  materialNameById,
  className,
}: ScoringImpactPanelProps) {
  const upliftPoints = regulation.compliance_uplift_points ?? 0;
  const statusWeight = regulation.status_severity_weight ?? 0.35;
  const proximityActive = regulation.proximity_window_active ?? false;
  const verified = regulation.verified;

  const statusLabel = humanizeRegulationStatus(regulation.status);

  // Aggregate material scopes by scope_type so we can show a per-group weight.
  const matByScope = new Map<string, RegulationMaterialScopeRead[]>();
  for (const s of regulation.material_scopes ?? []) {
    const list = matByScope.get(s.scope_type) ?? [];
    list.push(s);
    matByScope.set(s.scope_type, list);
  }

  // Geography scopes by role for the breakdown.
  const geoByScope = new Map<string, RegulationGeographyScopeRead[]>();
  for (const s of regulation.geography_scopes ?? []) {
    const list = geoByScope.get(s.scope_type) ?? [];
    list.push(s);
    geoByScope.set(s.scope_type, list);
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-border/60 bg-card p-5",
        className,
      )}
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Scoring impact</h2>
        <p className="text-xs text-muted-foreground">
          What this regulation contributes to material, geography, and
          company scores.
        </p>
      </header>

      {/* ── 1. Activation gate ─────────────────────────────────────────── */}
      <GateRow verified={verified} />

      {/* ── 2. Pillar contributions ────────────────────────────────────── */}
      <SubSection title="Pillars contributed to">
        <ul className="space-y-1.5 text-sm">
          <PillarRow
            label="Regulatory compliance"
            scope="Always — via per-event chain"
            active={true}
          />
          <PillarRow
            label="Material concentration (indirect)"
            scope={`${(regulation.material_scopes ?? []).length} material${(regulation.material_scopes ?? []).length === 1 ? "" : "s"} feed into material × geography rollup`}
            active={(regulation.material_scopes ?? []).length > 0}
          />
          <PillarRow
            label="Geopolitical (indirect)"
            scope={
              (geoByScope.get("targeted_country")?.length ?? 0) > 0
                ? `${geoByScope.get("targeted_country")!.length} targeted countr${(geoByScope.get("targeted_country")!.length === 1 ? "y" : "ies")} elevate geopolitical risk`
                : "Activated when targeted_country scopes are set"
            }
            active={(geoByScope.get("targeted_country")?.length ?? 0) > 0}
          />
        </ul>
      </SubSection>

      {/* ── 3. Per-event severity (Level 1) ────────────────────────────── */}
      <SubSection title="Per-event severity (Level 1)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            label="Status weight"
            value={statusWeight.toFixed(2)}
            sublabel={statusLabel}
          />
          <Metric
            label="Confidence"
            value="1.00"
            sublabel="Manifest-curated"
          />
          <Metric
            label="Recency mult."
            value={proximityActive ? "1.10–1.20" : "1.00"}
            sublabel={
              proximityActive
                ? "Within 90 days of effective"
                : "Outside ±90-day window"
            }
            highlight={proximityActive}
          />
          <Metric
            label="Max contribution"
            value={`${EVENT_SCORE_CAP} pts`}
            sublabel="Avg of top-3 events × 60"
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Per-event impact = <code className="font-mono">severity ×
          confidence × recency × scope_weight × geo_weight</code>. The
          regulatory pillar averages the top-3 such impacts and scales
          to 0–{EVENT_SCORE_CAP}.
        </p>
      </SubSection>

      {/* ── 4. Material scope weights ──────────────────────────────────── */}
      {matByScope.size > 0 && (
        <SubSection title="Material scope weights">
          <div className="space-y-2">
            {Array.from(matByScope.entries()).map(([scopeType, group]) => {
              const w = materialScopeWeight(scopeType);
              return (
                <div
                  key={scopeType}
                  className="rounded-md border border-border/40 bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium">
                      {humanizeMaterialScope(scopeType)}
                    </span>
                    <span className="font-mono text-xs text-foreground">
                      weight {w.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {group.length} material
                    {group.length === 1 ? "" : "s"}:{" "}
                    {group
                      .slice(0, 6)
                      .map((s) =>
                        materialDisplayName(
                          materialNameById?.[s.material_id] ??
                            `#${s.material_id}`,
                        ),
                      )
                      .join(", ")}
                    {group.length > 6 ? `, +${group.length - 6} more` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </SubSection>
      )}

      {/* ── 5. Geography scope weights ─────────────────────────────────── */}
      {geoByScope.size > 0 && (
        <SubSection title="Geography scope">
          <div className="space-y-1.5 text-xs">
            {Array.from(geoByScope.entries()).map(([scopeType, group]) => (
              <div
                key={scopeType}
                className="flex items-baseline justify-between gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {humanizeGeoScopeLabel(scopeType)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {group.map((g) => countryName(g.country_code)).join(", ")}
                  </span>
                </div>
                <span className="font-mono text-foreground">
                  weight 0.50
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Geography scope_type is recorded per role but currently flat
            0.50 in scoring regardless. Per-geography weighting via
            <code className="ml-1 font-mono">
              geography_compliance_weights
            </code>{" "}
            is supported but optional — currently NULL on this row.
          </p>
        </SubSection>
      )}

      {/* ── 6. Company-level uplift ────────────────────────────────────── */}
      <SubSection title="Company-level uplift (Level 4)">
        {upliftPoints > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric
                label="Per non-compliant"
                value={`${(upliftPoints * 1.0).toFixed(1)} pts`}
                sublabel={`${upliftPoints} × 1.00`}
                highlight
              />
              <Metric
                label="Per unknown"
                value={`${(upliftPoints * 0.5).toFixed(1)} pts`}
                sublabel={`${upliftPoints} × 0.50`}
              />
              <Metric
                label="Per partial"
                value={`${(upliftPoints * 0.4).toFixed(1)} pts`}
                sublabel={`${upliftPoints} × 0.40`}
              />
              <Metric
                label="Per compliant"
                value="0.0 pts"
                sublabel={`${upliftPoints} × 0.00`}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Sum of all regulation uplifts on a company is capped at{" "}
              {OBLIGATION_SCORE_CAP} points.
            </p>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/30">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
            <p className="leading-relaxed">
              <span className="font-medium">No direct uplift points.</span>{" "}
              This regulation is not in <code className="font-mono">COMPLIANCE_OBLIGATIONS</code>,
              so a company being non-compliant produces no Level-4
              uplift. The regulation still contributes through the event
              chain (Level 1) and through material × geography rollup.
            </p>
          </div>
        )}
      </SubSection>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border/60 pt-3 first:border-0 first:pt-0 [&_+_*]:mt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        highlight
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-border/40 bg-muted/30",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-medium tabular-nums">
        {value}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

function PillarRow({
  label,
  scope,
  active,
}: {
  label: string;
  scope: string;
  active: boolean;
}) {
  return (
    <li className="flex items-start gap-2">
      {active ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
      ) : (
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex-1">
        <span
          className={cn(
            "text-sm",
            active ? "font-medium" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <p className="text-xs text-muted-foreground">{scope}</p>
      </div>
    </li>
  );
}

function GateRow({ verified }: { verified: boolean }) {
  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
        verified
          ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
      )}
    >
      {verified ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      )}
      <p className="leading-relaxed">
        {verified ? (
          <>
            <span className="font-medium">Verified</span> — feeds the
            regulatory pillar (a signal in validation: shadow-scored at
            weight 0 in the published score until re-promotion). All scoring
            queries filter on{" "}
            <code className="font-mono">verified=True</code>.
          </>
        ) : (
          <>
            <span className="font-medium">Not verified</span> — excluded
            from scoring. The regulation is recorded but its events,
            scopes, and uplift points contribute zero until a partner
            reviewer toggles it verified.
          </>
        )}
      </p>
    </div>
  );
}

// Local label helper — slightly more descriptive than humanizeGeographyScope
// because we want to lead with the role, not the scope name.
function humanizeGeoScopeLabel(scopeType: string): string {
  switch (scopeType) {
    case "jurisdiction":
      return "Applies in";
    case "targeted_country":
      return "Targeted";
    case "origin_country":
      return "Origin";
    default:
      return scopeType;
  }
}
