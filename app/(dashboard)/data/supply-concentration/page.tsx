"use client";

/**
 * Supply Concentration — cross-material overview.
 *
 * Phase 3b transparency surface AND the Workstream A freshness instrument
 * (concentration-first scoring plan §2/A2): the audit strip's launch-list
 * tally IS the freshness exposure report, and the export button captures it
 * as a point-in-time artifact.
 *
 * The pillar is data-derived — no events, nothing to triage. Everything on
 * this page is served by /api/v1/concentration/overview, which reuses the
 * engine's own stage-max computation; nothing is recomputed client-side.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Star } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageLayout } from "@/components/platform/page-layout";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformTable } from "@/components/platform/platform-table";
import { ScoreChip } from "@/components/platform/score-chip";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupplyChainStageBadge, type SupplyChainStage } from "@/components/shared/supply-chain-stage-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AuditStrip } from "@/components/concentration/audit-strip";
import { ShareRibbon } from "@/components/concentration/share-ribbon";
import { Notice } from "@/components/concentration/notice";
import { useConcentrationOverview } from "@/lib/hooks/use-concentration";
import { humanize } from "@/lib/utils/format";
import type { AuditState, OverviewRow } from "@/lib/api/concentration";

function FreshnessCell({ row }: { row: OverviewRow }) {
  if (row.audit_state === "nostage") {
    return (
      <span className="text-xs italic text-muted-foreground/70">
        no stages mapped
      </span>
    );
  }
  if (row.audit_state === "understated") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-[18px] cursor-help items-center gap-1 whitespace-nowrap rounded border border-red-500/30 bg-red-100 px-1.5 text-[10px] font-semibold text-red-900 dark:bg-red-950 dark:text-red-200">
            <AlertTriangle size={11} />
            understated
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px]">
          A stage snapshot too old to score would otherwise be the binding
          chokepoint — the published score sits below concentration we already
          know about. Refreshing the snapshot, not changing the model, is the fix.
        </TooltipContent>
      </Tooltip>
    );
  }
  if (row.stale_stages.length) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-[18px] cursor-help items-center whitespace-nowrap rounded border border-amber-500/30 bg-amber-100 px-1.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {row.stale_stages.length} stale stage
            {row.stale_stages.length === 1 ? "" : "s"}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px]">
          {"Excluded from the max by the freshness gate: " +
            row.stale_stages
              .map((d) => `${humanize(d.stage)} @${d.reference_year}`)
              .join(", ") +
            ". The driving geography's score is unaffected" +
            (row.understated_geo_count
              ? `; ${row.understated_geo_count} smaller producer${row.understated_geo_count === 1 ? " is" : "s are"} understated.`
              : ".")}
        </TooltipContent>
      </Tooltip>
    );
  }
  return <span className="text-xs font-medium text-emerald-600">all fresh</span>;
}

export default function SupplyConcentrationPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useConcentrationOverview();

  const [search, setSearch] = useState("");
  const [audit, setAudit] = useState<AuditState | "">("");
  const [launchOnly, setLaunchOnly] = useState(false);

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items
      .filter((r) => {
        if (q && !(r.name + " " + (r.symbol ?? "")).toLowerCase().includes(q)) return false;
        if (launchOnly && !r.is_launch_list) return false;
        if (audit && r.audit_state !== audit) return false;
        return true;
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [data, search, audit, launchOnly]);

  const understatedCount = useMemo(
    () => (data?.items ?? []).filter((r) => r.audit_state === "understated").length,
    [data],
  );
  const noOreCount = useMemo(
    () => (data?.items ?? []).filter((r) => r.audit_state !== "nostage" && !r.ore).length,
    [data],
  );

  /** Point-in-time capture of the audit — the Workstream A artifact. */
  const exportAudit = () => {
    if (!data) return;
    const head = [
      "material", "launch_list", "audit_state", "score", "driving_geo",
      "binding_stage", "binding_year", "ore_hhi", "ore_year",
      "stale_stages", "understated_geo_count", "as_of",
    ];
    const lines = (data.items ?? []).map((r) =>
      [
        JSON.stringify(r.name), r.is_launch_list, r.audit_state,
        r.score?.toFixed(2) ?? "", r.driving_geo ?? "", r.binding_stage ?? "",
        r.binding_year ?? "", r.ore?.hhi_raw.toFixed(4) ?? "",
        r.ore?.reference_year ?? "",
        JSON.stringify(r.stale_stages.map((s) => `${s.stage}@${s.reference_year}`).join("; ")),
        r.understated_geo_count, data.as_of,
      ].join(","),
    );
    const tally = data.audit;
    const preamble = [
      `# Supply-concentration freshness audit — as of ${data.as_of} (freshness gate ${data.freshness_years}y, WGI vintage ${data.wgi_vintage ?? "n/a"})`,
      `# Launch list: ${tally.fully_fresh} fully fresh · ${tally.with_stale} with stale stages · ${tally.understated} understated · ${tally.no_stage} without stage data`,
    ];
    const blob = new Blob(
      [[...preamble, head.join(","), ...lines].join("\n")],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `concentration-audit-${data.as_of}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<ColumnDef<OverviewRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Material",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {row.original.is_launch_list && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Star size={13} className="shrink-0 text-primary" />
                </TooltipTrigger>
                <TooltipContent side="top">Launch-list material</TooltipContent>
              </Tooltip>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{row.original.name}</span>
              {row.original.symbol && (
                <span className="font-mono text-xs text-muted-foreground">
                  {row.original.symbol}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "score",
        header: "Pillar score",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.driving_geo || r.score == null) {
            return (
              <span className="text-xs italic text-muted-foreground/70">
                no stage data
              </span>
            );
          }
          return (
            <div className="flex items-center gap-1.5">
              <ScoreChip score={r.score} showBandLabel={false} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help font-mono text-[10px] text-muted-foreground">
                    {r.driving_geo}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Driving geography — the highest-scoring producer
                </TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
      {
        id: "binding",
        header: "Binding stage",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.binding_stage) return <span className="text-muted-foreground/60">—</span>;
          return (
            <div className="flex flex-col items-start gap-0.5">
              <SupplyChainStageBadge stage={r.binding_stage as SupplyChainStage} />
              {r.binding_year && (
                <span className="font-mono text-[9.5px] text-muted-foreground/70">
                  {r.binding_year}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "freshness",
        header: "Freshness",
        cell: ({ row }) => <FreshnessCell row={row.original} />,
      },
      {
        id: "hhi",
        header: "Ore-stage HHI",
        cell: ({ row }) => {
          const ore = row.original.ore;
          if (!ore) {
            return (
              <span className="text-xs italic text-muted-foreground/70">
                not computed
              </span>
            );
          }
          const prior = row.original.prior_ore_hhi;
          const delta = prior ? ore.hhi_raw - prior.hhi_raw : null;
          return (
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help font-mono text-[13px] font-semibold tabular-nums">
                    {ore.hhi_raw.toFixed(3)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Σshare² over the {ore.reference_year} ore snapshot · cliff-mapped
                  to {ore.hhi_cliff.toFixed(2)}
                </TooltipContent>
              </Tooltip>
              <span className="h-1.5 w-14 overflow-hidden rounded-sm bg-muted">
                <span
                  className="block h-full rounded-sm bg-slate-500"
                  style={{ width: `${Math.min(ore.hhi_raw * 100, 100)}%` }}
                />
              </span>
              {delta != null && Math.abs(delta) >= 0.001 && (
                <span
                  className={
                    "whitespace-nowrap text-[10px] font-semibold " +
                    (delta > 0 ? "text-red-600" : "text-emerald-600")
                  }
                  title={`Ore-stage HHI year-over-year vs ${prior!.reference_year} (${prior!.hhi_raw.toFixed(3)})`}
                >
                  {delta > 0 ? "↗ +" : "↘ "}
                  {delta.toFixed(3)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "market",
        header: "Market shape",
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <ShareRibbon
              rows={row.original.top_production}
              countryNames={data?.country_names ?? {}}
            />
          </div>
        ),
      },
      {
        id: "rli",
        header: "Reserve life",
        meta: { align: "right" },
        cell: ({ row }) => {
          const rli = row.original.reserve_life_index;
          if (rli == null) return <span className="text-muted-foreground/60">—</span>;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={
                    "cursor-help font-mono text-xs font-semibold tabular-nums " +
                    (rli <= 40 ? "text-orange-600" : "")
                  }
                >
                  {Math.round(rli)}y
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px]">
                Reserve life index — world reserves / annual production. Context
                only; it does not enter the concentration score.
              </TooltipContent>
            </Tooltip>
          );
        },
      },
    ],
    [data],
  );

  return (
    <PageLayout>
      <PageHeader
        title="Supply Concentration"
        subtitle="Producer concentration behind the material-concentration pillar. Scored stage-by-stage from USGS MCS and Benchmark share data — there are no events here to triage."
        actions={
          <Button variant="outline" size="sm" onClick={exportAudit} disabled={!data}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export audit
          </Button>
        }
      />

      {data && (
        <AuditStrip
          audit={data.audit}
          freshnessYears={data.freshness_years}
          active={audit}
          onFilter={setAudit}
        />
      )}

      {understatedCount > 0 && (
        <Notice tone="amber">
          {understatedCount} material{understatedCount === 1 ? " has" : "s have"} a
          stage whose snapshot is too old to score but which would otherwise be the
          binding chokepoint — those published scores sit below the concentration we
          already know about. Refreshing the snapshot, not changing the model, is
          the fix.
        </Notice>
      )}

      {data && (noOreCount > 0 || data.uncovered.length > 0) && (
        <Notice tone="amber">
          {noOreCount > 0 && (
            <>
              {noOreCount} covered material{noOreCount === 1 ? " has" : "s have"} no
              ore-stage shares mapped.{" "}
            </>
          )}
          {data.uncovered.length > 0 && (
            <>{data.uncovered.length} registry materials have no producer data at all. </>
          )}
          Missing components contribute zero, not a default — so these score lower
          than a measured low, and the gap is coverage rather than safety.
        </Notice>
      )}

      <DataTableToolbar
        actions={
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            {data && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    As of <strong className="font-medium text-foreground">{data.as_of}</strong>
                    {data.wgi_vintage != null && <> · WGI {data.wgi_vintage}</>}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px]">
                  Freshness is evaluated against this date. WGI vintage is the
                  governance-amplifier percentile year.
                </TooltipContent>
              </Tooltip>
            )}
            <span>
              {rows.length} of {data?.items.length ?? 0} covered
            </span>
          </div>
        }
      >
        <Input
          placeholder="Search material..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-[220px]"
        />
        <Button
          variant={launchOnly ? "secondary" : "outline"}
          size="sm"
          aria-pressed={launchOnly}
          onClick={() => setLaunchOnly((v) => !v)}
        >
          <Star className="mr-1.5 h-3.5 w-3.5" />
          Launch list only
        </Button>
        {(search || audit || launchOnly) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setAudit("");
              setLaunchOnly(false);
            }}
          >
            Reset
          </Button>
        )}
      </DataTableToolbar>

      <PlatformTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        onRowClick={(r) => router.push(`/data/supply-concentration/${r.material_id}`)}
        emptyTitle="No materials match your filters"
        emptyDescription="Clear the audit or launch-list filter to widen the set."
      />

      {data && data.uncovered.length > 0 && (
        <div className="rounded-md border border-dashed border-border px-4 py-3.5">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            No producer data
          </p>
          <div className="flex flex-col gap-1.5">
            {data.uncovered.map((u) => (
              <div key={u.material_id} className="flex items-baseline gap-2.5 text-xs">
                <span className="font-medium text-foreground">{u.name}</span>
                {u.symbol && (
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    {u.symbol}
                  </span>
                )}
                <span className="ml-auto text-muted-foreground">
                  No stage shares or production rows in the registry
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
