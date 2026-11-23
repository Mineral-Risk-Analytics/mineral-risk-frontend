"use client";

/**
 * Per-material event coverage, measured the way the engine measures it.
 *
 * Ported from the design system's MaterialCoverageTracker. Thresholds come
 * from the backend payload (`target`, `window_days`) rather than local
 * constants — they are the dashboard coverage-gaps thresholds, and serving
 * them keeps this card incapable of disagreeing with the dashboard about
 * what "thin" means.
 *
 * Why this sits on the triage screen and not the dashboard: a material below
 * the bar with suggestions waiting in the queue is a *triage backlog* — clear
 * the queue and the gap may close. A material below the bar with nothing
 * pending is a *sourcing problem*, and no amount of triage will fix it. The
 * two look identical in a plain count; the confirmed/pending split is the
 * whole point of the card.
 */

import { useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, Inbox, Star } from "lucide-react";
import type { MaterialCoverage, MaterialCoverageItem } from "@/lib/api/triage";

function Bar({
  confirmed,
  pending,
  target,
}: {
  confirmed: number;
  pending: number;
  target: number;
}) {
  const scale = Math.max(target, confirmed + pending);
  const pctC = scale ? (confirmed / scale) * 100 : 0;
  const pctP = scale ? (pending / scale) * 100 : 0;
  const barPct = scale ? (target / scale) * 100 : 0;

  return (
    <div
      style={{
        position: "relative",
        height: 8,
        borderRadius: "var(--p-radius-pill, 999px)",
        background: "var(--p-bg-muted)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", height: "100%" }}>
        <div
          title={confirmed + " confirmed — counted by scoring"}
          style={{
            width: pctC + "%",
            background:
              confirmed >= target ? "var(--p-risk-low)" : "var(--p-risk-mod)",
          }}
        />
        {/* Hatched: present in the queue, contributing nothing yet. */}
        <div
          title={pending + " awaiting triage — not counted until confirmed"}
          style={{
            width: pctP + "%",
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--p-slate-300) 0 3px, transparent 3px 6px)",
          }}
        />
      </div>
      {barPct < 100 && (
        <span
          aria-hidden
          title={"Coverage bar: " + target + " events"}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: barPct + "%",
            width: 1,
            background: "var(--p-text-muted)",
          }}
        />
      )}
    </div>
  );
}

function Row({
  item,
  target,
  onSelect,
  selected,
}: {
  item: MaterialCoverageItem;
  target: number;
  onSelect: (item: MaterialCoverageItem) => void;
  selected: boolean;
}) {
  const short = item.confirmed < target;
  const closable = short && item.pending > 0 && item.confirmed + item.pending >= target;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      title={
        closable
          ? item.pending +
            " pending event" +
            (item.pending === 1 ? "" : "s") +
            " would clear this gap — click to triage them"
          : short
            ? "Below the " +
              target +
              "-event bar with " +
              (item.pending ? "only " + item.pending + " pending" : "nothing pending") +
              " — click to filter"
            : "Covered — click to filter the queue to this material"
      }
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 42px 96px",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "7px 8px",
        borderRadius: "var(--p-radius-sm)",
        border: "1px solid " + (selected ? "var(--p-accent)" : "transparent"),
        background: selected ? "var(--p-accent-soft)" : "transparent",
        textAlign: "left",
        cursor: "pointer",
        transition:
          "background var(--p-dur, 120ms) var(--p-ease, ease), border-color var(--p-dur, 120ms) var(--p-ease, ease)",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--p-bg-subtle)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        {item.is_launch_list && (
          <span
            title="Launch-list material — a coverage gap here is a launch blocker"
            style={{ display: "inline-flex", flexShrink: 0, color: "var(--p-accent)" }}
          >
            <Star size={11} strokeWidth={2} />
          </span>
        )}
        {short && (
          <span
            title={closable ? "Gap closable from the queue" : "Thin coverage"}
            style={{
              display: "inline-flex",
              flexShrink: 0,
              color: closable ? "var(--p-risk-mod)" : "var(--p-risk-crit)",
            }}
          >
            {closable ? (
              <Inbox size={12} strokeWidth={2} />
            ) : (
              <AlertTriangle size={12} strokeWidth={2} />
            )}
          </span>
        )}
        <span
          style={{
            fontSize: "var(--p-text-xs, 12px)",
            fontWeight: short ? 600 : 400,
            color: "var(--p-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.name}
        </span>
      </span>

      <span
        style={{
          fontFamily: "var(--p-font-mono)",
          fontSize: "var(--p-text-xs, 12px)",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
          color:
            item.confirmed >= target
              ? "var(--p-risk-low)"
              : item.confirmed === 0
                ? "var(--p-risk-crit)"
                : "var(--p-risk-mod)",
        }}
      >
        {item.confirmed}
        {item.pending > 0 && (
          <span
            title={item.pending + " awaiting triage"}
            style={{ fontWeight: 400, color: "var(--p-text-faint)" }}
          >
            +{item.pending}
          </span>
        )}
      </span>

      <Bar confirmed={item.confirmed} pending={item.pending} target={target} />
    </button>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--p-card)",
  border: "1px solid var(--p-border)",
  borderRadius: "var(--p-radius-md)",
  boxShadow: "var(--p-elev-1)",
};

const MAX_ROWS = 8;

export interface MaterialCoverageCardProps {
  coverage: MaterialCoverage;
  selectedName: string;
  onSelect: (item: MaterialCoverageItem) => void;
}

export function MaterialCoverageCard({
  coverage,
  selectedName,
  onSelect,
}: MaterialCoverageCardProps) {
  const { items, target, window_days: windowDays } = coverage;
  const [thinOnly, setThinOnly] = useState(true);

  const sorted = useMemo(() => {
    const list = thinOnly ? items.filter((i) => i.confirmed < target) : items;
    /* Worst first, and among equals the ones with a queue backlog first —
       those are the actionable rows. */
    return [...list].sort(
      (a, b) =>
        a.confirmed - b.confirmed ||
        b.pending - a.pending ||
        a.name.localeCompare(b.name),
    );
  }, [items, thinOnly, target]);

  const thin = items.filter((i) => i.confirmed < target);
  const closable = thin.filter(
    (i) => i.pending > 0 && i.confirmed + i.pending >= target,
  );
  const starved = thin.filter((i) => i.pending === 0);
  /* Only launch-list gaps are launch blockers — the engine's coverage-gaps
     endpoint iterates LAUNCH_LIST_CANONICAL_NAMES and nothing else. */
  const blockers = thin.filter((i) => i.is_launch_list).length;
  const shown = sorted.slice(0, MAX_ROWS);

  return (
    <div style={cardStyle}>
      <div
        style={{
          padding: "14px 16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "var(--p-text-md, 14px)",
            fontWeight: 600,
            color: "var(--p-text)",
          }}
        >
          Material coverage
        </h3>
        <span
          style={{ fontSize: "var(--p-text-xs, 12px)", color: "var(--p-text-muted)" }}
        >
          Confirmed events per material · last {windowDays} days · {target}-event
          bar
        </span>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            title={
              "Materials with fewer than " +
              target +
              " confirmed events in the last " +
              windowDays +
              " days"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: "var(--p-badge-h, 18px)",
              padding: "0 7px",
              borderRadius: 3,
              fontSize: "var(--p-text-2xs, 10px)",
              fontWeight: 600,
              background: thin.length
                ? "var(--p-risk-mod-soft)"
                : "var(--p-risk-low-soft)",
              color: thin.length ? "#92400E" : "#065F46",
            }}
          >
            {thin.length} thin
          </span>
          {blockers > 0 && (
            <span
              title={
                blockers +
                " of them are launch-list materials, where a coverage gap is a launch blocker"
              }
              style={{ fontSize: "var(--p-text-2xs, 10px)", color: "var(--p-text-muted)" }}
            >
              {blockers} launch-list
            </span>
          )}
          {closable.length > 0 && (
            <span
              title="Below the bar, but enough events are already in the queue to close the gap — this is triage backlog, not missing data"
              style={{ fontSize: "var(--p-text-2xs, 10px)", color: "var(--p-text-muted)" }}
            >
              {closable.length} closable from the queue
            </span>
          )}
          {starved.length > 0 && (
            <span
              title="Below the bar with nothing pending — triage cannot fix these; they need new sources"
              style={{ fontSize: "var(--p-text-2xs, 10px)", color: "var(--p-risk-crit)" }}
            >
              {starved.length} with no signal at all
            </span>
          )}
          <button
            type="button"
            onClick={() => setThinOnly((v) => !v)}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              fontSize: "var(--p-text-2xs, 10px)",
              fontWeight: 500,
              color: "var(--p-accent)",
            }}
          >
            {thinOnly ? "Show all materials" : "Show thin only"}
          </button>
        </div>

        {shown.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: "var(--p-text-xs, 12px)",
              fontStyle: "italic",
              color: "var(--p-text-muted)",
            }}
          >
            Every tracked material clears the {target}-event bar.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {shown.map((i) => (
              <Row
                key={i.material_id}
                item={i}
                target={target}
                onSelect={onSelect}
                selected={i.name === selectedName}
              />
            ))}
          </div>
        )}

        {sorted.length > shown.length && (
          <span style={{ fontSize: 10, color: "var(--p-text-faint)" }}>
            +{sorted.length - shown.length} more
          </span>
        )}

        <p
          style={{
            margin: 0,
            fontSize: 10,
            lineHeight: 1.45,
            color: "var(--p-text-muted)",
          }}
        >
          Counts confirmed, direct links on scoring events in the last{" "}
          {windowDays} days (non-duplicate). Hatched bar segments are events
          still awaiting triage — present, but contributing nothing until
          promoted. Display-only events count toward neither. Only launch-list
          gaps (★) are launch blockers.
        </p>
      </div>
    </div>
  );
}
