"use client";

import { humanize } from "@/lib/utils/format";
import type { GeoResult } from "@/lib/api/concentration";

function Step({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span
        className={
          "font-mono text-[17px] font-semibold leading-tight tabular-nums " +
          (tone ?? "text-foreground")
        }
      >
        {value}
      </span>
      {sub && (
        <span className="text-[9.5px] leading-snug text-muted-foreground">{sub}</span>
      )}
    </div>
  );
}

/**
 * The 4.1 governance amplifier, rendered as three explicit steps because it is
 * the one place the displayed sub-scores and the published score diverge — the
 * engine amplifies only the stage max and keeps sub-scores raw.
 */
export function GovernanceStep({
  geo,
  geoName,
  result,
  beta,
}: {
  geo: string;
  geoName?: string;
  result: GeoResult;
  beta: number;
}) {
  if (!result.binding_stage) {
    return (
      <p className="text-xs italic text-muted-foreground">
        {geoName || geo} has no fresh stage share, so it scores 0 — non-producers
        are not amplified.
      </p>
    );
  }

  const arrow = <span aria-hidden className="self-center text-sm text-muted-foreground/50">→</span>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-3.5">
        <Step
          label="Stage max (raw)"
          value={result.raw_score.toFixed(1)}
          sub={humanize(result.binding_stage)}
        />
        {arrow}
        {result.wgi_pct == null ? (
          <Step
            label="WGI composite"
            value="n/a"
            sub="fewer than 4 of 6 dimensions — no-op"
            tone="text-muted-foreground"
          />
        ) : (
          <Step
            label="WGI percentile"
            value={result.wgi_pct.toFixed(0)}
            sub={`instability ${(result.instability ?? 0).toFixed(2)} · β ${beta}`}
          />
        )}
        {arrow}
        <Step
          label="Amplified score"
          value={result.score.toFixed(1)}
          sub={
            result.amplified
              ? `+${(result.score - result.raw_score).toFixed(1)} from jurisdiction instability`
              : "unchanged — no usable governance signal"
          }
          tone={result.amplified ? "text-primary" : undefined}
        />
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Bounded soft-ceiling amplification, so 75% held in an unstable jurisdiction
        scores above 75% held in a stable one without near-max materials pinning at
        100. Only the stage max is amplified — the per-stage sub-scores above stay raw.
      </p>
    </div>
  );
}
