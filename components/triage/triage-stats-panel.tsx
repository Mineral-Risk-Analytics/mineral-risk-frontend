"use client";

/**
 * Suggestion-quality panel — the measurement surface for the triage
 * feedback loop (triage plan §7; D0 re-promotion gate 3).
 *
 * Two tables over GET /triage/stats: per-source HUMAN decision outcomes
 * (with the pillar correction rate), and material-link suggestion quality
 * per (source × match_reason) — the numbers that eventually justify
 * suggester changes ("hs_code links get rejected N% of the time") instead
 * of guesswork. Collapsed by default: this is an analysis surface, the
 * queue is the work surface.
 *
 * Rates computed on fewer decisions than the server's
 * small_sample_threshold render with a caution banner — 3 decisions is an
 * anecdote, not a rate.
 */

import { useMemo, useState } from "react";
import type { TriageLinkQualityStats } from "@/lib/api/triage";
import { useTriageStats } from "@/lib/hooks/use-triage";

const th: React.CSSProperties = {
  textAlign: "right",
  padding: "6px 8px",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--p-track-label, 0.06em)",
  color: "var(--p-text-muted)",
  whiteSpace: "nowrap",
};

const thLeft: React.CSSProperties = { ...th, textAlign: "left" };

const td: React.CSSProperties = {
  textAlign: "right",
  padding: "5px 8px",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  color: "var(--p-text)",
  borderTop: "1px solid var(--p-border)",
  whiteSpace: "nowrap",
};

const tdLeft: React.CSSProperties = { ...td, textAlign: "left" };
const tdMuted: React.CSSProperties = { ...td, color: "var(--p-text-muted)" };

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** Roll the per-(source × match_reason) rows up to match_reason alone —
 *  the default view. The cross-product is the right granularity for
 *  drilling into a bad rate, but as a first read it made the panel longer
 *  than the queue itself (Nicole, 2026-10-05). */
function rollupByReason(
  rows: TriageLinkQualityStats[],
): TriageLinkQualityStats[] {
  const acc = new Map<string, TriageLinkQualityStats>();
  for (const r of rows) {
    const cur = acc.get(r.match_reason) ?? {
      source: "all sources",
      match_reason: r.match_reason,
      confirmed: 0,
      rejected: 0,
      untouched: 0,
      decided: 0,
      confirm_rate: null,
    };
    cur.confirmed += r.confirmed;
    cur.rejected += r.rejected;
    cur.untouched += r.untouched;
    cur.decided += r.decided;
    acc.set(r.match_reason, cur);
  }
  const out = [...acc.values()];
  for (const r of out) {
    r.confirm_rate = r.decided > 0 ? r.confirmed / r.decided : null;
  }
  out.sort((a, b) => b.decided - a.decided || a.match_reason.localeCompare(b.match_reason));
  return out;
}

export function TriageStatsPanel() {
  const [open, setOpen] = useState(false);
  const [bySource, setBySource] = useState(false);
  // Lazy by design (self-review fix, 2026-10-06): the stats query scans the
  // whole corpus server-side and sits in the `triage` invalidation family,
  // so an always-on query made EVERY triage decision re-pay it. Disabled
  // until the panel is opened; invalidation then only refetches it while
  // it is actually mounted and enabled.
  const { data: stats, isError, isLoading } = useTriageStats({ enabled: open });
  const small =
    !!stats && stats.human_decisions_total < stats.small_sample_threshold;
  const linkRows = useMemo(
    () =>
      !stats
        ? []
        : bySource
          ? stats.link_quality
          : rollupByReason(stats.link_quality),
    [bySource, stats],
  );

  return (
    <section
      style={{
        borderRadius: "var(--p-radius-md)",
        border: "1px solid var(--p-border)",
        background: "var(--p-card)",
        padding: "10px 12px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "var(--p-track-label, 0.06em)",
            color: "var(--p-text-muted)",
          }}
        >
          Suggestion quality {open ? "▾" : "▸"}
        </span>
        <span style={{ fontSize: 12, color: "var(--p-text-muted)" }}>
          {stats
            ? `${stats.human_decisions_total} human decision${
                stats.human_decisions_total === 1 ? "" : "s"
              } measured`
            : "expand to compute"}
        </span>
      </button>

      {open && !stats && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "var(--p-text-muted)",
          }}
        >
          {isError
            ? "Couldn't load suggestion statistics — is the stats endpoint deployed?"
            : isLoading
              ? "Computing…"
              : null}
        </div>
      )}

      {open && stats && (
        /* Hard cap on the WHOLE expanded body (Nicole, 2026-10-05): the
           panel scrolls internally and can never dominate the page —
           whatever the tables grow to, the queue below stays the page's
           main event. */
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 14,
            maxHeight: 300,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {small && (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.45,
                color: "var(--p-text-muted)",
                border: "1px dashed var(--p-border)",
                borderRadius: "var(--p-radius-sm, 6px)",
                padding: "6px 10px",
              }}
            >
              Small sample: rates below are computed on fewer than{" "}
              {stats.small_sample_threshold} decisions and should be read as
              anecdotes, not calibration. They firm up as triage volume
              grows.
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={thLeft}>Source</th>
                  <th style={th} title="Human decisions (triaged_at stamped)">
                    Decided
                  </th>
                  <th style={th}>Scoring</th>
                  <th style={th}>Display</th>
                  <th style={th}>Rejected</th>
                  <th style={th} title="Human kept the machine's pillar">
                    Pillar kept
                  </th>
                  <th style={th} title="Human changed the machine's pillar">
                    Corrected
                  </th>
                  <th style={th}>Correction rate</th>
                  <th
                    style={th}
                    title="Machine-routed display-only (no human stamp) — context, not judgment"
                  >
                    Machine
                  </th>
                  <th style={th}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {stats.sources.map((s) => (
                  <tr key={s.source}>
                    <td style={tdLeft}>{s.source}</td>
                    <td style={td}>{s.human_decisions}</td>
                    <td style={td}>{s.scoring}</td>
                    <td style={td}>{s.display_only}</td>
                    <td style={td}>{s.rejected}</td>
                    <td style={td}>{s.category_confirmed}</td>
                    <td style={td}>{s.category_corrected}</td>
                    <td style={td}>{pct(s.correction_rate)}</td>
                    <td style={tdMuted}>{s.machine_display_only}</td>
                    <td style={tdMuted}>{s.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "var(--p-track-label, 0.06em)",
                  color: "var(--p-text-muted)",
                }}
              >
                Link suggestions by match reason
              </span>
              <button
                type="button"
                onClick={() => setBySource((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--p-accent)",
                }}
              >
                {bySource ? "Roll up" : "Break out by source"}
              </button>
            </div>
            {/* The outer body is already height-capped; the breakout keeps
                its own inner cap so a long source list scrolls here instead
                of pushing the first table out of view. */}
            <div
              style={{
                overflowX: "auto",
                ...(bySource ? { maxHeight: 180, overflowY: "auto" } : {}),
              }}
            >
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {bySource && <th style={thLeft}>Source</th>}
                    <th style={thLeft}>Match reason</th>
                    <th style={th}>Confirmed</th>
                    <th style={th}>Rejected</th>
                    <th style={th} title="Confirmed / decided">
                      Confirm rate
                    </th>
                    <th
                      style={th}
                      title="Links still in 'suggested' — queue, not judgment"
                    >
                      Untouched
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linkRows.map((l) => (
                    <tr key={`${l.source}:${l.match_reason}`}>
                      {bySource && <td style={tdLeft}>{l.source}</td>}
                      <td style={{ ...tdLeft, fontFamily: "var(--p-mono, monospace)", fontSize: 11 }}>
                        {l.match_reason}
                      </td>
                      <td style={td}>{l.confirmed}</td>
                      <td style={td}>{l.rejected}</td>
                      <td style={td}>{pct(l.confirm_rate)}</td>
                      <td style={tdMuted}>{l.untouched}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
