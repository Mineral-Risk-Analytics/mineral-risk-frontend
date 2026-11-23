"use client";

/**
 * Severity and confidence chips — the single source of truth for both ramps.
 *
 * These bands were previously duplicated in the risk-events page and in the
 * triage drawer, and both copies had drifted to a 3-band ramp at 0.7 / 0.5.
 * The design system defines FOUR severity bands (75 / 55 / 35) and a SEPARATE
 * two-breakpoint confidence ramp (75 / 50) whose semantics are inverted — high
 * confidence is good, so it reads emerald where high severity reads red.
 * The two are not interchangeable; do not collapse them back into one.
 *
 * Colours are literal hex rather than --p-* tokens on purpose: these are
 * fixed semantic ramps from the design system, not theme surfaces, and the
 * chips must render identically inside the Radix portal (side sheets, dialogs)
 * where the platform token scope does not reach.
 */

import type { CSSProperties } from "react";

export interface ScoreBand {
  label: string;
  fill: string;
  color: string;
  border: string;
  bar: string;
}

/** ≥75 red · ≥55 orange · ≥35 amber · else emerald.  Input is 0–100. */
export function severityBandFor(scoreOutOf100: number): ScoreBand {
  if (scoreOutOf100 >= 75)
    return {
      label: "High",
      fill: "#FEF2F2",
      color: "#B91C1C",
      border: "#FECACA",
      bar: "#EF4444",
    };
  if (scoreOutOf100 >= 55)
    return {
      label: "Medium-high",
      fill: "#FFF7ED",
      color: "#C2410C",
      border: "#FED7AA",
      bar: "#F97316",
    };
  if (scoreOutOf100 >= 35)
    return {
      label: "Medium",
      fill: "#FFFBEB",
      color: "#B45309",
      border: "#FDE68A",
      bar: "#F59E0B",
    };
  return {
    label: "Low",
    fill: "#ECFDF5",
    color: "#047857",
    border: "#A7F3D0",
    bar: "#10B981",
  };
}

/** ≥75 emerald · ≥50 amber · else neutral.  Input is 0–100. */
export function confidenceBandFor(scoreOutOf100: number): ScoreBand {
  if (scoreOutOf100 >= 75)
    return {
      label: "High",
      fill: "#ECFDF5",
      color: "#047857",
      border: "#A7F3D0",
      bar: "#10B981",
    };
  if (scoreOutOf100 >= 50)
    return {
      label: "Medium",
      fill: "#FFFBEB",
      color: "#B45309",
      border: "#FDE68A",
      bar: "#F59E0B",
    };
  // Neutral rather than red: low confidence is a "we don't know" signal, not a
  // danger signal.  Literal values of --p-bg-subtle / --p-text-muted / --p-border.
  return {
    label: "Low",
    fill: "#F1F5F9",
    color: "#64748B",
    border: "#E2E8F0",
    bar: "#64748B",
  };
}

/** Accepts either the 0–1 API shape or an already-scaled 0–100 value. */
function toHundred(score: number): number {
  return score <= 1 ? Math.round(score * 100) : Math.round(score);
}

const chipStyle = (band: ScoreBand): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  height: "var(--p-badge-h, 20px)",
  padding: "0 7px",
  borderRadius: 3,
  fontSize: "var(--p-text-2xs, 11px)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
  whiteSpace: "nowrap",
  background: band.fill,
  color: band.color,
  border: "1px solid " + band.border,
});

function EmDash() {
  return (
    <span style={{ fontSize: "var(--p-text-xs, 12px)", color: "var(--p-text-faint)" }}>
      —
    </span>
  );
}

export function SeverityChip({
  score,
  showLabel = false,
}: {
  score: number | null;
  showLabel?: boolean;
}) {
  if (score == null) return <EmDash />;
  const out100 = toHundred(score);
  const band = severityBandFor(out100);
  return (
    <span
      title={`Severity ${out100} / 100 · ${band.label} — machine-assigned`}
      style={chipStyle(band)}
    >
      {out100}
      {showLabel && <span style={{ fontWeight: 500 }}>· {band.label}</span>}
    </span>
  );
}

export function ConfidenceChip({
  score,
  showLabel = false,
}: {
  score: number | null;
  showLabel?: boolean;
}) {
  if (score == null) return null;
  const out100 = toHundred(score);
  const band = confidenceBandFor(out100);
  return (
    <span
      title={`Confidence ${out100} / 100 · ${band.label} — machine confidence in the extraction`}
      style={chipStyle(band)}
    >
      {out100}%
      {showLabel && <span style={{ fontWeight: 500 }}>· {band.label}</span>}
    </span>
  );
}
