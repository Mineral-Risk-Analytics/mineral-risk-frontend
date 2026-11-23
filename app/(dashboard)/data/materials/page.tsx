"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Star } from "lucide-react";
import { PlatformTable } from "@/components/platform/platform-table";
import { DataTablePagination } from "@/components/data-table/pagination";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { CountrySharePill } from "@/components/shared/country-share-pill";
import { PageLayout } from "@/components/platform/page-layout";
import { PageHeader } from "@/components/platform/page-header";
import { ScoreChip } from "@/components/platform/score-chip";
import { PillarCoverageDots } from "@/components/materials/pillar-coverage-dots";
import { useMaterials } from "@/lib/hooks/use-materials";
import type { MaterialListItem } from "@/lib/types";
import { humanize } from "@/lib/utils/format";
import {
  INITIAL_MATERIAL_FILTERS,
  MaterialsFilterBar,
  type MaterialsFilters,
} from "./materials-filter-bar";

const DEFAULT_LIMIT = 25;

// 2026-05-11 refresh: the Materials list now drives an analyst-focused
// view scoped to the launch-list materials by default.  HS-mismatch UI
// retired; per-row data centered on "what do I know about this mineral?"
// (risk score + concentration + 5-pillar coverage + recent events).

export default function MaterialsListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [filters, setFilters] = useState<MaterialsFilters>(
    INITIAL_MATERIAL_FILTERS,
  );

  const apiParams = useMemo(
    () => ({
      page,
      limit,
      search: filters.search || undefined,
      category: filters.category || undefined,
      // Default page state filters down to the launch list; user toggle
      // flips the param off to show all materials.
      is_launch_list: filters.launch_list_only ? true : undefined,
    }),
    [page, limit, filters],
  );

  const { data, isLoading, error, refetch, isFetching } =
    useMaterials(apiParams);

  const columns = useMemo<ColumnDef<MaterialListItem, unknown>[]>(
    () => [
      {
        accessorKey: "canonical_name",
        header: "Material",
        cell: ({ row }) => {
          const { canonical_name, symbol_or_code, category, verified, is_launch_list } = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                {is_launch_list && (
                  <span
                    title="Launch-list material (core 10)"
                    className="inline-flex"
                    style={{ color: "var(--p-accent)" }}
                  >
                    <Star className="h-3.5 w-3.5 fill-current" />
                  </span>
                )}
                <span className="font-medium">{canonical_name}</span>
                <VerifiedBadge verified={verified} />
              </div>
              <span className="text-xs text-muted-foreground">
                {[symbol_or_code, humanize(category)].filter(Boolean).join(" · ")}
              </span>
            </div>
          );
        },
      },
      {
        id: "risk",
        // 5.0: the published number is the concentration pillar alone.
        header: () => <div className="text-right">Structural Risk</div>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <ScoreChip
              score={row.original.latest_overall_risk_score}
              showBandLabel={true}
              insufficientData={row.original.concentration_scored === false}
            />
          </div>
        ),
      },
      {
        id: "concentration",
        header: "Concentration",
        cell: ({ row }) => {
          const shares = row.original.top_producer_shares;
          if (!shares || shares.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="flex flex-wrap items-center gap-1">
              {shares.slice(0, 3).map((c) => (
                <CountrySharePill
                  key={c.code}
                  code={c.code}
                  sharePct={c.share_pct}
                />
              ))}
            </div>
          );
        },
      },
      {
        id: "coverage",
        header: () => (
          // Two-line header — "Coverage" up top, a tiny "M · G · R · O · F"
          // legend below the title.  The letter positions roughly mirror
          // the dot positions in each row so the analyst can decode
          // which dot is which pillar without hovering each one.
          // Tooltip on the legend spells the full mapping.
          <div className="flex flex-col gap-0.5">
            <span>Coverage</span>
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"
              title={
                "M = Material Concentration · " +
                "G = Geopolitical / Trade · " +
                "R = Regulatory Compliance · " +
                "O = Operational · " +
                "F = Financial Pressure"
              }
            >
              {["M", "G", "R", "O", "F"].map((letter) => (
                <span
                  key={letter}
                  style={{
                    display: "inline-block",
                    width: 8,
                    textAlign: "center",
                  }}
                >
                  {letter}
                </span>
              ))}
            </span>
          </div>
        ),
        cell: ({ row }) => (
          <PillarCoverageDots pillars={row.original.pillar_scores} />
        ),
      },
      {
        id: "events_90d",
        header: () => <div className="text-right">Events 90d</div>,
        cell: ({ row }) => {
          const n = row.original.recent_event_count_90d;
          if (n === 0) {
            return (
              <div className="text-right text-xs text-muted-foreground">—</div>
            );
          }
          // Weight scales with volume: bold for ≥20, normal 5-19,
          // faint for <5.  Matches the coverage matrix cell convention.
          const fontWeight = n >= 20 ? 600 : n >= 5 ? 500 : 400;
          return (
            <div
              className="text-right font-mono tabular-nums"
              style={{ fontSize: 13, fontWeight }}
            >
              {n}
            </div>
          );
        },
      },
    ],
    [],
  );

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleFiltersChange = (next: MaterialsFilters) => {
    setFilters(next);
    setPage(1);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Materials"
        subtitle="Canonical material registry.  Click a row to drill into per-mineral detail."
      />

      <MaterialsFilterBar
        value={filters}
        onChange={handleFiltersChange}
        total={data?.total}
      />

      <PlatformTable
        data={rows}
        columns={columns}
        isLoading={isLoading || (isFetching && rows.length === 0)}
        error={error}
        onRetry={() => refetch()}
        onRowClick={(row) => router.push(`/data/materials/${row.id}`)}
        emptyTitle="No materials match your filters"
        emptyDescription={
          filters.launch_list_only
            ? "Try toggling off 'Launch list only' to see the full registry."
            : "Try clearing filters or broadening your search."
        }
      />

      <DataTablePagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
      />
    </PageLayout>
  );
}
