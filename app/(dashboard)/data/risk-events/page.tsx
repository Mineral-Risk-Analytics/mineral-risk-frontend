"use client";

/**
 * Risk-events triage queue.
 *
 * The ingest pipeline is inverted here: the machine proposes, a human
 * disposes. Ingesters attach suggestions — pillar, entity links, type,
 * weight — and nothing is authoritative until it passes through this queue.
 *
 * Consequences that shape the screen:
 * · The default view is the QUEUE (pending_triage), not everything.
 * · Suggestions are visibly provisional: a suggested pillar reads differently
 *   from a confirmed one, because the difference decides whether it scores.
 * · Confirming a whole event unchanged is one action ("Accept all").
 * · Every decision reverses. Un-approve and un-dismiss are first-class.
 * · Operational news candidates cannot be approved directly — approval
 *   supplies subtype and severity via the promote dialog.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Flag, Inbox, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLayout } from "@/components/platform/page-layout";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformTable } from "@/components/platform/platform-table";
import { DataTablePagination } from "@/components/data-table/pagination";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { CategoryCell, PILLAR_ORDER, PILLARS } from "@/components/triage/category-cell";
import { EventTriageDrawer } from "@/components/triage/event-triage-drawer";
import { LinksCell } from "@/components/triage/links-cell";
import { PromoteOperationalDialog } from "@/components/triage/promote-operational-dialog";
import { QualityDefectChips } from "@/components/triage/quality-defect-chips";
import { SeverityChip } from "@/components/triage/score-chips";
import { MaterialCoverageCard } from "@/components/triage/material-coverage-card";
import { QueueSummaryCard } from "@/components/triage/queue-summary-card";
import { TriageStatusControl } from "@/components/triage/triage-status-control";
import {
  acceptSuggestions,
  getTriageEvent,
  setLinkStatus,
  setPrimaryCategory,
  setTriageStatus,
  type LinkStatus,
  type TriageEvent,
  type TriageListParams,
  type TriageStatus,
} from "@/lib/api/triage";
import { getMaterials } from "@/lib/api/materials";
import {
  triageQueryKeys,
  useMaterialCoverage,
  useTriageApi,
  useTriageEvents,
  useTriageSummary,
} from "@/lib/hooks/use-triage";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate, humanize } from "@/lib/utils/format";

const DEFAULT_LIMIT = 25;

/* Positive-direction detection used to live here as a local copy of the
   backend's POSITIVE_EVENT_SUBTYPES, and it had drifted: three of its four
   entries were not in the backend set and the real POSITIVE_DEVELOPMENT was
   missing, so the "cannot approve" guard fired on the wrong rows. The API now
   serves `is_positive` on every event — read it, do not re-derive it. */

const STATUS_OPTIONS: Array<{ value: TriageStatus | ""; label: string }> = [
  /* Not "All": the list endpoint excludes dismissed rows unless the dismissed
     filter is chosen explicitly, because soft dismiss means hidden. Labelling
     it "All" claimed a completeness the query does not deliver. */
  { value: "", label: "All active" },
  { value: "pending_triage", label: "Pending triage" },
  { value: "scoring", label: "Scoring" },
  { value: "display_only", label: "Display only" },
  { value: "rejected", label: "Dismissed" },
];

const SEVERITY_OPTIONS = [
  { value: "0.75", label: "High (≥ 75)" },
  { value: "0.55", label: "Medium (≥ 55)" },
  { value: "0.35", label: "Low (≥ 35)" },
];

const DIRECTION_OPTIONS = [
  { value: "restrictive", label: "Restrictive" },
  { value: "supportive", label: "Supportive" },
  { value: "neutral", label: "Neutral" },
];

/** Canonical `sources.name` values (each ingester's _SOURCE_NAME + the
 *  manual loader's). Seeds the source facet so every source is selectable
 *  from page one; the dynamic merge still widens it if a new source
 *  appears in loaded rows. Keep in sync with the engine's ingesters. */
const KNOWN_SOURCES = [
  "EUR-Lex",
  "Federal Register API",
  "Global Trade Alert",
  "IEA Critical Minerals Policy Tracker",
  "OpenSanctions",
  "Operational news watchlist",
  "manual_walkthrough",
];

/** Display-name overrides for raw sources.name values that read poorly
 *  as chips. Filter VALUES stay the raw names (backend exact match). */
const SOURCE_FACET_LABELS: Record<string, string> = {
  manual_walkthrough: "Manual workbook",
};

const DEFECT_OPTIONS = [
  { value: "truncated_summary", label: "Truncated summary" },
  { value: "future_date", label: "Future date" },
  { value: "no_provenance", label: "No provenance" },
  { value: "no_source_url", label: "No source URL" },
  { value: "needs_material_review", label: "Needs material review" },
];

const SORTABLE = new Set(["event_date", "severity_score", "triage_status"]);

/* Row height was being set by whichever event happened to have the longest
   summary — ingest slices those at 500 characters, so a single row could run
   eight or nine lines and push everything else off screen. Clamping is the
   right lever rather than dropping the summary (which is what the wireframe
   does): the summary is the only thing on the row that says what actually
   happened, and two lines of it is enough to decide whether to open the
   drawer. Full text is one click away, and sits in the `title` attribute for
   a hover.

   `-webkit-line-clamp` is the only way to ellipsise at a line count rather
   than a character count; it is prefixed but implemented in every current
   engine, and the failure mode where it is not — text simply not truncating —
   is what the page does today anyway. `minWidth: 0` is required because these
   spans sit in flex containers, where the default `min-width: auto` refuses
   to shrink below the content's intrinsic width and defeats the overflow. */
function clampLines(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
    minWidth: 0,
  };
}

interface Filters {
  search: string;
  status: TriageStatus | "";
  pillar: string;
  direction: string;
  source: string;
  eventType: string;
  severityMin: string;
  defect: string;
  material: string;
  /** Geography code (countries.iso2); matches primary and secondary alike. */
  country: string;
  /** Any defect at all. Orthogonal to `defect`, which names exactly one. */
  hasDefects: boolean;
  /** Carries at least one open data-quality note. */
  flagged: boolean;
}

const INITIAL_FILTERS: Filters = {
  search: "",
  status: "pending_triage",
  pillar: "",
  direction: "",
  source: "",
  eventType: "",
  severityMin: "",
  defect: "",
  material: "",
  country: "",
  hasDefects: false,
  flagged: false,
};

/* SeverityScoreChip used to live here with a 3-band ramp at 0.7 / 0.5 that
   matched neither the design system nor the drawer's own copy of the same
   widget — the same score rendered a different colour depending on which
   surface you were looking at. Both now import components/triage/score-chips. */

function StatusPillGroup({
  value,
  onChange,
}: {
  value: TriageStatus | "";
  onChange: (next: TriageStatus | "") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Triage status"
      style={{
        display: "inline-flex",
        borderRadius: "var(--p-radius-md)",
        border: "1px solid var(--p-border)",
        overflow: "hidden",
      }}
    >
      {STATUS_OPTIONS.map((o, i) => {
        const on = value === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            style={{
              height: 32,
              padding: "0 10px",
              border: "none",
              borderRight:
                i === STATUS_OPTIONS.length - 1
                  ? "none"
                  : "1px solid var(--p-border)",
              background: on ? "var(--p-bg-muted)" : "var(--p-card)",
              color: on ? "var(--p-text)" : "var(--p-text-muted)",
              fontFamily: "var(--p-font-sans)",
              fontSize: "var(--p-text-xs, 12px)",
              fontWeight: on ? 600 : 500,
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition: "background var(--p-dur, 120ms) var(--p-ease, ease)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Radix Select cannot carry an empty-string item value, so "" maps to "all". */
function FacetSelect({
  value,
  onChange,
  allLabel,
  options,
  width = 150,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  width?: number;
  ariaLabel: string;
}) {
  return (
    <Select
      value={value === "" ? "all" : value}
      onValueChange={(v) => onChange(v === "all" ? "" : v)}
    >
      <SelectTrigger
        className="h-9"
        style={{ width }}
        aria-label={ariaLabel}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function RiskEventsTriagePage() {
  const api = useTriageApi();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [localSearch, setLocalSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const [openEvent, setOpenEvent] = useState<TriageEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<TriageEvent | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setFilter = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  // Debounced search, matching the old page's 300ms pattern.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => {
        if (f.search === localSearch) return f;
        setPage(1);
        return { ...f, search: localSearch };
      });
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  const sortId = sorting[0]?.id;
  const sortParam = sortId && SORTABLE.has(sortId)
    ? (sortId as NonNullable<TriageListParams["sort"]>)
    : undefined;
  /* The header's ascending/descending state was being computed and then
     dropped: sorting is manual, so the server decides order, and it defaults
     to desc. Clicking a header to flip direction changed the arrow and nothing
     else. Only send a direction when a sort column is actually in play. */
  const sortDirParam = sortParam
    ? sorting[0]?.desc === false
      ? ("asc" as const)
      : ("desc" as const)
    : undefined;

  const apiParams = useMemo<TriageListParams>(
    () => ({
      page,
      limit,
      status: filters.status || undefined,
      search: filters.search || undefined,
      pillar: filters.pillar || undefined,
      direction: filters.direction || undefined,
      source: filters.source || undefined,
      event_type: filters.eventType || undefined,
      severity_min: filters.severityMin ? Number(filters.severityMin) : undefined,
      material: filters.material || undefined,
      country: filters.country || undefined,
      defect: filters.defect || undefined,
      // Sent only when true: the backend treats these as plain booleans, and a
      // `false` still forces the slower Python-side filter path.
      has_defects: filters.hasDefects || undefined,
      flagged: filters.flagged || undefined,
      sort: sortParam,
      sort_dir: sortDirParam,
    }),
    [page, limit, filters, sortParam, sortDirParam],
  );

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch: refetchList,
  } = useTriageEvents(apiParams);
  const { data: summary } = useTriageSummary();
  const { data: coverage } = useMaterialCoverage();
  const queryClient = useQueryClient();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  // Facet options accumulate across loads so a selected value never vanishes
  // from its own select while the filtered list omits it.
  // 2026-08-17 (Nicole): the source facet is SEEDED with the canonical
  // sources.name values instead of starting empty — previously options
  // accumulated only from loaded rows, so a source with no event on the
  // current page (notably the manual workbook's ~200 events, deep in a
  // 1,100+ queue) was unfindable from the filter. Values must match
  // sources.name exactly; backend `?source=` is an exact match.
  const [sourceOptions, setSourceOptions] = useState<string[]>(KNOWN_SOURCES);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [materialOptions, setMaterialOptions] = useState<string[]>([]);
  /* code → display name. Accumulated like the other facets, but as a map:
     the filter value is the code (what the backend matches on) while the
     label wants the resolved name, and a later page may supply a name for a
     code an earlier page carried bare. */
  const [countryOptions, setCountryOptions] = useState<Record<string, string>>(
    {},
  );
  useEffect(() => {
    const items = data?.items ?? [];
    const merge = (prev: string[], next: Array<string | null>) => {
      const set = new Set(prev);
      for (const v of next) if (v) set.add(v);
      const merged = [...set].sort();
      return merged.length === prev.length ? prev : merged;
    };
    setSourceOptions((prev) => merge(prev, items.map((e) => e.source_system)));
    setTypeOptions((prev) => merge(prev, items.map((e) => e.event_type)));
    /* The backend matches `material` on canonical_name exactly, so this has to
       be a closed list — a free-text box would return nothing for any spelling
       the corpus does not use. Seeded from the launch list below, then widened
       with whatever the loaded rows actually link to. */
    setMaterialOptions((prev) =>
      merge(prev, items.flatMap((e) => e.links.map((l) => l.label))),
    );
    setCountryOptions((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const e of items) {
        for (const c of e.geography_codes) {
          const name = e.geography_names?.[c] ?? "";
          if (!(c in next) || (name && next[c] !== name)) {
            next[c] = name || next[c] || "";
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [data]);

  // Launch-list materials, fetched once, so the material facet is useful before
  // a page happens to contain a link to the material you care about.
  useEffect(() => {
    let live = true;
    getMaterials(api, { page: 1, limit: 100, is_launch_list: true })
      .then((res) => {
        if (!live) return;
        setMaterialOptions((prev) => {
          const set = new Set(prev);
          for (const m of res.data ?? []) set.add(m.canonical_name);
          const merged = [...set].sort();
          return merged.length === prev.length ? prev : merged;
        });
      })
      .catch(() => {
        // Non-fatal: the facet still fills in from loaded rows.
      });
    return () => {
      live = false;
    };
  }, [api]);

  // Ref mirror of the open drawer event id, so refreshAfterMutation can stay
  // identity-stable while still knowing whether the drawer copy needs a
  // refresh (the mutated row may have left the filtered list entirely).
  const openEventIdRef = useRef<number | null>(null);
  useEffect(() => {
    openEventIdRef.current = openEvent?.id ?? null;
  }, [openEvent]);

  const refreshAfterMutation = useCallback(
    async (eventId?: number) => {
      // One invalidation covers every triage surface — list, summary, AND the
      // coverage tracker (confirming or rejecting a link is exactly the
      // mutation that moves an event between the tracker's hatched and solid
      // segments). Replaces the old three-way refetch chain; invalidation
      // awaits the refetch of whichever of those queries is mounted.
      await queryClient.invalidateQueries({ queryKey: triageQueryKeys.all });
      if (eventId != null && openEventIdRef.current === eventId) {
        try {
          const fresh = await getTriageEvent(api, eventId);
          setOpenEvent((c) => (c?.id === eventId ? fresh : c));
        } catch {
          // Keep the stale drawer copy; the list refetch already succeeded.
        }
      }
    },
    [api, queryClient],
  );

  const runMutation = useCallback(
    async (eventId: number, fn: () => Promise<unknown>) => {
      setPendingId(eventId);
      setActionError(null);
      try {
        await fn();
        await refreshAfterMutation(eventId);
      } catch (err: unknown) {
        setActionError(
          err instanceof Error ? err.message : "The change was not saved",
        );
      } finally {
        setPendingId(null);
      }
    },
    [refreshAfterMutation],
  );

  const handleStatus = useCallback(
    (ev: TriageEvent, next: TriageStatus) => {
      /* Approving an operational news candidate must supply subtype and
         severity — route through the promote dialog instead of the plain
         status transition. */
      if (next === "scoring" && ev.event_type === "operational_news_candidate") {
        setPromoteTarget(ev);
        return;
      }
      void runMutation(ev.id, () => setTriageStatus(api, ev.id, next));
    },
    [api, runMutation],
  );

  const handleAccept = useCallback(
    (eventId: number) => {
      void runMutation(eventId, () => acceptSuggestions(api, eventId));
    },
    [api, runMutation],
  );

  const handleCategory = useCallback(
    (eventId: number, category: string) => {
      void runMutation(eventId, () => setPrimaryCategory(api, eventId, category));
    },
    [api, runMutation],
  );

  const handleLinkStatus = useCallback(
    (linkId: number, next: LinkStatus) => {
      const ev = openEvent;
      if (!ev) return;
      void runMutation(ev.id, () => setLinkStatus(api, linkId, next));
    },
    [api, openEvent, runMutation],
  );

  const openDrawer = useCallback((ev: TriageEvent) => {
    setOpenEvent(ev);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo<ColumnDef<TriageEvent, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Event",
        enableSorting: false,
        cell: ({ row }) => {
          const e = row.original;
          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                maxWidth: 360,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span
                  title={e.title}
                  style={{
                    fontWeight: 500,
                    textWrap: "pretty",
                    ...clampLines(2),
                  }}
                >
                  {e.title}
                </span>
                {/* The wireframe marks rows that need attention, not rows that
                    are fine. A verified check said "approved" — which the
                    Decision column already says, in words, on the same row —
                    while an open data-quality note, the one thing that should
                    pull an eye across the table, rendered nowhere. */}
                {e.flags.length > 0 && (
                  <span
                    title={
                      e.flags.length +
                      " open data-quality note" +
                      (e.flags.length === 1 ? "" : "s")
                    }
                    style={{
                      display: "inline-flex",
                      flexShrink: 0,
                      marginTop: 2,
                      color: "var(--p-risk-crit)",
                    }}
                  >
                    <Flag size={13} strokeWidth={2.25} />
                  </span>
                )}
              </div>
              {e.summary && (
                <span
                  title={e.summary}
                  style={{
                    fontSize: "var(--p-text-xs, 12px)",
                    lineHeight: 1.45,
                    color: "var(--p-text-muted)",
                    textWrap: "pretty",
                    ...clampLines(2),
                  }}
                >
                  {e.summary}
                </span>
              )}
              {/* Source and geography ride in the title cell rather than in a
                  column of their own, as in the wireframe — they are context
                  for the headline, not a facet you scan down. That buys back
                  the width the Type column needs. */}
              <span style={{ fontSize: 10, color: "var(--p-text-faint)" }}>
                {[e.source_system || "uncredited", e.geography_primary]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <QualityDefectChips defects={e.quality_defects} />
            </div>
          );
        },
      },
      {
        id: "category",
        header: "Scoring pillar",
        cell: ({ row }) => <CategoryCell event={row.original} />,
      },
      {
        id: "links",
        header: "Entity links",
        cell: ({ row }) => <LinksCell links={row.original.links} />,
      },
      {
        accessorKey: "event_type",
        header: "Type",
        enableSorting: false,
        cell: ({ row }) => {
          const t = row.original.event_type;
          /* The toolbar has had a Type filter all along with no column to read
             the result against — you could narrow to a type and not see which
             type any row was. */
          return t ? (
            <Badge variant="outline">{humanize(t)}</Badge>
          ) : (
            <span
              style={{
                fontSize: "var(--p-text-xs, 12px)",
                color: "var(--p-text-faint)",
              }}
            >
              —
            </span>
          );
        },
      },
      {
        accessorKey: "severity_score",
        header: "Severity",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SeverityChip score={row.original.severity_score} />
          </div>
        ),
      },
      {
        accessorKey: "event_date",
        header: "Date",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => {
          const e = row.original;
          return (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span
                style={{
                  fontSize: "var(--p-text-xs, 12px)",
                  fontVariantNumeric: "tabular-nums",
                  color: e.quality_defects.includes("future_date")
                    ? "var(--p-risk-crit)"
                    : "var(--p-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {e.event_date ? formatDate(e.event_date) : "—"}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "triage_status",
        header: "Decision",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => {
          const e = row.original;
          /* "Accept all" means "the machine was right, promote it as proposed",
             so it is only offered where that is actually a legal transition.
             It used to be gated on having a suggestion alone, which offered it
             on rows the backend refuses outright: a positive-direction event is
             excluded from risk arithmetic, and an operational news candidate
             needs a subtype and severity that only the promote dialog collects.
             Both returned a 400 into the error banner. */
          const acceptable =
            e.triage_status === "pending_triage" &&
            !e.is_positive &&
            e.event_type !== "operational_news_candidate" &&
            (e.suggested_category != null ||
              e.links.some((l) => l.status === "suggested"));
          return (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 6,
              }}
              onClick={(ev) => ev.stopPropagation()}
            >
              {acceptable && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === e.id}
                  title="Accept all suggestions — confirm the suggested pillar and links in one action"
                  onClick={() => handleAccept(e.id)}
                >
                  Accept all
                </Button>
              )}
              <TriageStatusControl
                status={e.triage_status}
                size="sm"
                pending={pendingId === e.id}
                disallow={e.is_positive ? ["scoring"] : undefined}
                disallowReason="Positive-direction event — excluded from risk arithmetic, so approving would have no effect"
                onChange={(next) => handleStatus(e, next)}
              />
            </div>
          );
        },
      },
    ],
    [pendingId, handleAccept, handleStatus],
  );

  const dirty =
    localSearch !== "" ||
    (Object.keys(INITIAL_FILTERS) as Array<keyof Filters>).some(
      (k) => filters[k] !== INITIAL_FILTERS[k],
    );

  const pendingCount = summary?.pending_triage ?? 0;

  return (
    <PageLayout>
      <PageHeader
        title="Risk Events"
        subtitle="Triage queue. The ingest engine proposes a pillar and entity links; an analyst confirms, corrects, or dismisses each event. Confirmed events feed the content feed and build the validation record that re-promotes the event pillars — the published score is concentration-only until those gates clear."
      />

      {/* Coverage sits beside the queue on purpose: "which materials are
          thin" is only answerable next to "what is still unreviewed". The
          grid collapses to the queue card alone while coverage loads (or if
          the endpoint errors) — the queue is the work surface, coverage is
          the map, and the map is not worth a blocked page. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: coverage ? "1fr 1.35fr" : "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {summary && (
          <QueueSummaryCard
            summary={summary}
            active={filters.status}
            onFilter={(s) => {
              setFilters({ ...INITIAL_FILTERS, status: s });
              setLocalSearch("");
              setPage(1);
            }}
          />
        )}
        {coverage && (
          <MaterialCoverageCard
            coverage={coverage}
            selectedName={filters.material}
            onSelect={(m) => {
              // Row click filters the queue to that material — mirroring the
              // material facet select, and toggling off on a second click.
              setFilters({
                ...INITIAL_FILTERS,
                status: "",
                material: filters.material === m.name ? "" : m.name,
              });
              setLocalSearch("");
              setPage(1);
            }}
          />
        )}
      </div>

      <DataTableToolbar
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: "var(--p-text-xs, 12px)",
                color: "var(--p-text-muted)",
              }}
            >
              {total.toLocaleString()} events
            </span>
            {pendingCount > 0 && filters.status !== "pending_triage" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters({ ...INITIAL_FILTERS, status: "pending_triage" });
                  setLocalSearch("");
                  setPage(1);
                }}
              >
                <Inbox className="h-3.5 w-3.5" />
                {pendingCount} pending
              </Button>
            )}
          </div>
        }
      >
        <StatusPillGroup
          value={filters.status}
          onChange={(v) => setFilter({ status: v })}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title or summary..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-9 w-[210px] pl-8"
          />
        </div>
        <FacetSelect
          ariaLabel="Scoring pillar"
          allLabel="All pillars"
          width={160}
          value={filters.pillar}
          onChange={(v) => setFilter({ pillar: v })}
          options={PILLAR_ORDER.map((p) => ({
            value: p,
            label: PILLARS[p]?.label ?? humanize(p),
          }))}
        />
        <FacetSelect
          ariaLabel="Material"
          allLabel="All materials"
          width={155}
          value={filters.material}
          onChange={(v) => setFilter({ material: v })}
          options={materialOptions.map((m) => ({ value: m, label: m }))}
        />
        <FacetSelect
          ariaLabel="Country"
          allLabel="All countries"
          width={165}
          value={filters.country}
          onChange={(v) => setFilter({ country: v })}
          options={Object.entries(countryOptions)
            .map(([code, name]) => ({
              value: code,
              label: name ? `${name} (${code})` : code,
            }))
            .sort((a, b) => a.label.localeCompare(b.label))}
        />
        <FacetSelect
          ariaLabel="Direction"
          allLabel="All directions"
          width={140}
          value={filters.direction}
          onChange={(v) => setFilter({ direction: v })}
          options={DIRECTION_OPTIONS}
        />
        <FacetSelect
          ariaLabel="Source"
          allLabel="All sources"
          width={140}
          value={filters.source}
          onChange={(v) => setFilter({ source: v })}
          options={sourceOptions.map((s) => ({
            value: s,
            label: SOURCE_FACET_LABELS[s] ?? s,
          }))}
        />
        <FacetSelect
          ariaLabel="Event type"
          allLabel="All types"
          width={150}
          value={filters.eventType}
          onChange={(v) => setFilter({ eventType: v })}
          options={typeOptions.map((t) => ({ value: t, label: humanize(t) }))}
        />
        <FacetSelect
          ariaLabel="Minimum severity"
          allLabel="Any severity"
          width={145}
          value={filters.severityMin}
          onChange={(v) => setFilter({ severityMin: v })}
          options={SEVERITY_OPTIONS}
        />
        <FacetSelect
          ariaLabel="Quality defects"
          allLabel="All defects"
          width={165}
          value={filters.defect}
          onChange={(v) => setFilter({ defect: v })}
          options={DEFECT_OPTIONS}
        />
        {/* Two toggles the wireframe carries and the page did not. "Has
            defects" is not the same question as the defect select beside it —
            that one names a single code, this one asks "show me everything the
            ingest pipeline is unsure about". "Flagged" is the only way to find
            the events a human has already written a note against. */}
        <Button
          variant={filters.hasDefects ? "default" : "outline"}
          size="sm"
          aria-pressed={filters.hasDefects}
          title="Only events carrying at least one quality defect"
          onClick={() => setFilter({ hasDefects: !filters.hasDefects })}
        >
          Has defects
        </Button>
        <Button
          variant={filters.flagged ? "default" : "outline"}
          size="sm"
          aria-pressed={filters.flagged}
          title="Only events with an open data-quality note"
          onClick={() => setFilter({ flagged: !filters.flagged })}
        >
          Flagged
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters(INITIAL_FILTERS);
              setLocalSearch("");
              setSorting([]);
              setPage(1);
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </DataTableToolbar>

      {actionError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
            borderRadius: "var(--p-radius-md)",
            border: "1px solid rgba(225, 29, 72, 0.25)",
            background: "var(--p-risk-crit-soft)",
            padding: "8px 12px",
            fontSize: "var(--p-text-xs, 12px)",
            color: "#9F1239",
          }}
        >
          <span>{actionError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setActionError(null)}
            style={{
              display: "inline-flex",
              border: "none",
              background: "transparent",
              color: "#9F1239",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <PlatformTable
        data={rows}
        columns={columns}
        isLoading={isLoading || (isFetching && rows.length === 0)}
        error={error}
        onRetry={() => void refetchList()}
        onRowClick={openDrawer}
        sorting={sorting}
        onSortingChange={(updater) => {
          setSorting(updater);
          setPage(1);
        }}
        manualSorting
        emptyTitle={
          filters.status === "pending_triage"
            ? "Nothing left in the queue"
            : "No events match the current filters"
        }
        emptyDescription={
          filters.status === "pending_triage"
            ? "Every event in this filter set has been triaged. Switch to All active to review past decisions."
            : "Try widening the severity threshold or clearing filters."
        }
      />

      <DataTablePagination
        page={page}
        limit={data?.limit ?? limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
      />

      <EventTriageDrawer
        open={drawerOpen}
        event={openEvent}
        pending={openEvent != null && pendingId === openEvent.id}
        disallowScoring={openEvent?.is_positive ?? false}
        onClose={() => setDrawerOpen(false)}
        onStatus={(id, next) => {
          const ev =
            openEvent?.id === id ? openEvent : rows.find((r) => r.id === id);
          if (ev) handleStatus(ev, next);
        }}
        onCategory={handleCategory}
        onLinkStatus={handleLinkStatus}
        onAccept={handleAccept}
        onFlagged={() => void refreshAfterMutation(openEvent?.id)}
      />

      <PromoteOperationalDialog
        open={promoteTarget != null}
        event={promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onPromoted={() => void refreshAfterMutation(promoteTarget?.id)}
      />
    </PageLayout>
  );
}
