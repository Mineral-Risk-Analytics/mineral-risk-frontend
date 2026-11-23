"use client";

import { CountrySharePill } from "@/components/shared/country-share-pill";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Producer } from "@/lib/api/concentration";

/** Ordered slate ramp for ribbon segments — darkest for the largest share. */
const SEGMENT_CLASSES = [
  "bg-slate-900 dark:bg-slate-200",
  "bg-slate-700 dark:bg-slate-400",
  "bg-slate-600 dark:bg-slate-500",
  "bg-slate-500",
  "bg-slate-400 dark:bg-slate-600",
  "bg-slate-300 dark:bg-slate-700",
];

/**
 * Horizontal stacked bar of producer shares — the shape of the market in one
 * row. Reuses CountrySharePill (flag + code + % + name tooltip) for the top
 * producers rather than reinventing a legend.
 */
export function ShareRibbon({
  rows,
  countryNames,
  maxPills = 4,
}: {
  rows: Producer[];
  countryNames: Record<string, string>;
  maxPills?: number;
}) {
  const sorted = [...rows].sort((a, b) => b.production_share - a.production_share);
  const covered = sorted.reduce((a, r) => a + r.production_share, 0);
  const rest = Math.max(0, 1 - covered);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 overflow-hidden rounded-sm bg-muted">
        {sorted.map((r, i) => (
          <Tooltip key={r.country_code}>
            <TooltipTrigger asChild>
              <span
                className={
                  "cursor-help border-r border-background " +
                  SEGMENT_CLASSES[Math.min(i, SEGMENT_CLASSES.length - 1)]
                }
                style={{ width: `${r.production_share * 100}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              {(countryNames[r.country_code] || r.country_code) +
                " — " +
                (r.production_share * 100).toFixed(1) +
                "%"}
            </TooltipContent>
          </Tooltip>
        ))}
        {rest > 0.001 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="cursor-help bg-slate-200 dark:bg-slate-800"
                style={{ width: `${rest * 100}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              Other producers — {(rest * 100).toFixed(1)}%
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {sorted.slice(0, maxPills).map((r) => (
          <CountrySharePill
            key={r.country_code}
            code={r.country_code}
            sharePct={Math.round(r.production_share * 100)}
            name={countryNames[r.country_code]}
          />
        ))}
        {sorted.length > maxPills && (
          <span className="text-[10px] text-muted-foreground">
            +{sorted.length - maxPills}
          </span>
        )}
      </div>
    </div>
  );
}
