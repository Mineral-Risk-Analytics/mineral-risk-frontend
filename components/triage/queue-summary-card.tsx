"use client";

/**
 * Queue summary — four clickable status tiles plus a stacked proportion bar.
 * The count that matters is what is unreviewed: this is a work surface, and
 * the default view of the page is the pending queue.
 */

import type { CSSProperties } from "react";
import type { TriageStatus, TriageSummary } from "@/lib/api/triage";

export interface QueueSummaryCardProps {
  summary: TriageSummary;
  active: string;
  onFilter: (status: TriageStatus | "") => void;
}

function Tile({
  label,
  value,
  tone,
  status,
  title,
  active,
  onFilter,
}: {
  label: string;
  value: number;
  tone: string | null;
  status: TriageStatus;
  title: string;
  active: boolean;
  onFilter: (status: TriageStatus | "") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onFilter(status)}
      title={title}
      style={{
        borderRadius: "var(--p-radius-md)",
        border:
          "1px solid " + (active ? "var(--p-accent)" : "var(--p-border)"),
        background: "var(--p-card)",
        padding: 10,
        textAlign: "left",
        cursor: "pointer",
        transition: "background var(--p-dur, 120ms) var(--p-ease, ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--p-bg-subtle)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--p-card)";
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "var(--p-track-label, 0.06em)",
          color: "var(--p-text-muted)",
          lineHeight: 1.25,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 24,
          fontWeight: 600,
          lineHeight: 1.05,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "var(--p-track-kpi, -0.02em)",
          color: tone ?? "var(--p-text)",
        }}
      >
        {value}
      </div>
    </button>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--p-card)",
  border: "1px solid var(--p-border)",
  borderRadius: "var(--p-radius-md)",
  boxShadow: "var(--p-elev-1)",
};

export function QueueSummaryCard({
  summary,
  active,
  onFilter,
}: QueueSummaryCardProps) {
  const {
    pending_triage: pending,
    scoring,
    display_only: displayOnly,
    rejected,
    total,
  } = summary;
  const reviewed = total - pending;

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
          Triage queue
        </h3>
        <span
          style={{ fontSize: "var(--p-text-xs, 12px)", color: "var(--p-text-muted)" }}
        >
          {reviewed} of {total} events reviewed
        </span>
      </div>
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
            gap: 10,
          }}
        >
          <Tile
            label="Pending"
            value={pending}
            tone={pending > 0 ? "var(--p-risk-mod)" : null}
            status="pending_triage"
            active={active === "pending_triage"}
            onFilter={onFilter}
            title="Awaiting review — attached suggestions are not authoritative and do not score"
          />
          <Tile
            label="Scoring"
            value={scoring}
            tone={scoring > 0 ? "var(--p-risk-low)" : null}
            status="scoring"
            active={active === "scoring"}
            onFilter={onFilter}
            title="Confirmed — feeds pillar scoring and the content feed"
          />
          <Tile
            label="Display only"
            value={displayOnly}
            tone={null}
            status="display_only"
            active={active === "display_only"}
            onFilter={onFilter}
            title="Industry-relevant and shown in the feed, but attributed to nothing for scoring"
          />
          <Tile
            label="Dismissed"
            value={rejected}
            tone={null}
            status="rejected"
            active={active === "rejected"}
            onFilter={onFilter}
            title="Soft-dismissed — hidden everywhere, retained so dedupe cannot resurrect them"
          />
        </div>
        <div
          style={{
            marginTop: 10,
            height: 6,
            borderRadius: "var(--p-radius-pill, 999px)",
            background: "var(--p-bg-muted)",
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            title={scoring + " scoring"}
            style={{
              width: (total ? (scoring / total) * 100 : 0) + "%",
              background: "var(--p-risk-low)",
            }}
          />
          <div
            title={displayOnly + " display only"}
            style={{
              width: (total ? (displayOnly / total) * 100 : 0) + "%",
              background: "var(--p-slate-400)",
            }}
          />
          <div
            title={rejected + " dismissed"}
            style={{
              width: (total ? (rejected / total) * 100 : 0) + "%",
              background: "var(--p-slate-300)",
            }}
          />
        </div>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 10,
            lineHeight: 1.45,
            color: "var(--p-text-muted)",
          }}
        >
          Scoring reads only confirmed events and confirmed links. Until an
          event is triaged, its machine-suggested pillar and links contribute
          nothing.
        </p>
      </div>
    </div>
  );
}
