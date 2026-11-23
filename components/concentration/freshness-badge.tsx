"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Says whether a snapshot participates in scoring — the reference year alone
 * does not, because the freshness gate is relative to the scoring as-of date
 * (engine: stage_concentration.FRESHNESS_YEARS). Fresh = quiet outline;
 * stale = amber, because a stale snapshot is excluded from the stage max.
 */
export function FreshnessBadge({
  referenceYear,
  asOfYear,
  freshnessYears,
  compact = false,
}: {
  referenceYear: number | null | undefined;
  asOfYear: number;
  freshnessYears: number;
  compact?: boolean;
}) {
  if (referenceYear == null) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  const age = asOfYear - referenceYear;
  const stale = age > freshnessYears;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded border px-1.5 font-medium leading-none",
            compact ? "h-4 text-[9px]" : "h-[18px] text-[10px]",
            stale
              ? "border-amber-500/40 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              : "border-border bg-transparent text-muted-foreground",
          )}
        >
          <span className="font-mono tabular-nums">{referenceYear}</span>
          {stale ? "stale" : "fresh"}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        {stale
          ? `Snapshot is ${age} years behind the ${asOfYear} as-of date (gate is ${freshnessYears}). Excluded from the stage max — reported, never scored.`
          : `Within ${freshnessYears} years of the ${asOfYear} as-of date, so this snapshot participates in scoring.`}
      </TooltipContent>
    </Tooltip>
  );
}
