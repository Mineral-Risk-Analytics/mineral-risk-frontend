/**
 * Where an event sits relative to scoring. Mirrors `_event_status` in
 * event_dedupe.py — the distinction a reviewer needs before promoting a
 * candidate: `scoring` means promoting a near-duplicate double-counts;
 * `rejected` means a human already judged the same story to be noise.
 */

import type { TriageStatus } from "@/lib/api/triage";

interface StatusStyle {
  label: string;
  background: string;
  color: string;
  border: string;
}

const STATUS: Record<TriageStatus, StatusStyle> = {
  scoring: {
    label: "Scoring",
    background: "var(--p-risk-low-soft)",
    color: "#065F46",
    border: "rgba(5, 150, 105, 0.3)",
  },
  pending_triage: {
    label: "Pending triage",
    background: "var(--p-risk-mod-soft)",
    color: "#92400E",
    border: "rgba(217, 119, 6, 0.3)",
  },
  rejected: {
    label: "Rejected",
    background: "var(--p-bg-muted)",
    color: "var(--p-text-muted)",
    border: "var(--p-border)",
  },
  display_only: {
    label: "Display only",
    background: "var(--p-card)",
    color: "var(--p-text-muted)",
    border: "var(--p-border)",
  },
};

const TITLES: Record<TriageStatus, string> = {
  scoring:
    "Already contributing to a pillar score — promoting a duplicate of this would double-count",
  pending_triage: "Two feeds landed the same story; only one should be promoted",
  rejected: "An analyst already judged this story to be noise",
  display_only:
    "Visible in the feed but not selected by any pillar scoring query",
};

export function EventStatusBadge({ status }: { status: TriageStatus }) {
  const s = STATUS[status] ?? STATUS.display_only;
  return (
    <span
      title={TITLES[status] ?? TITLES.display_only}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "var(--p-badge-h, 20px)",
        padding: "0 7px",
        borderRadius: 3,
        fontSize: "var(--p-text-2xs, 11px)",
        fontWeight: 500,
        whiteSpace: "nowrap",
        lineHeight: 1,
        background: s.background,
        color: s.color,
        border: "1px solid " + s.border,
      }}
    >
      {s.label}
    </span>
  );
}
