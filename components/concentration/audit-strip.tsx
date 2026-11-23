"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AuditState, AuditTally } from "@/lib/api/concentration";

interface CellDef {
  key: AuditState;
  label: string;
  tone: string;
  title: string;
}

/**
 * Launch-list freshness tally — the Workstream A readout. Doubles as a filter
 * row: clicking a cell filters the overview to that audit state, clicking it
 * again clears. The four states are exhaustive and mutually exclusive per
 * material (understated implies stale, but a material counts once, in its
 * worst state).
 */
export function AuditStrip({
  audit,
  freshnessYears,
  active,
  onFilter,
}: {
  audit: AuditTally;
  freshnessYears: number;
  active: AuditState | "";
  onFilter: (next: AuditState | "") => void;
}) {
  const cells: Array<CellDef & { value: number }> = [
    {
      key: "fresh",
      label: "launch-list materials fully fresh",
      value: audit.fully_fresh,
      tone: audit.fully_fresh > 0 ? "text-emerald-600" : "text-foreground",
      title: `Every mapped stage has a snapshot within ${freshnessYears} years of the as-of date`,
    },
    {
      key: "stale",
      label: "with stale stages",
      value: audit.with_stale,
      tone: audit.with_stale > 0 ? "text-amber-600" : "text-foreground",
      title: "At least one stage is gated out of the max by the freshness rule",
    },
    {
      key: "understated",
      label: "scores understated by staleness",
      value: audit.understated,
      tone: audit.understated > 0 ? "text-red-600" : "text-foreground",
      title:
        "A gated-out stage would have been the binding max — the published score sits below the known chokepoint",
    },
    {
      key: "nostage",
      label: "with no stage data",
      value: audit.no_stage,
      tone: "text-muted-foreground",
      title: "No stage-share rows at all, so the pillar has nothing to score",
    },
  ];

  return (
    <div className="flex gap-2.5">
      {cells.map((c) => {
        const on = active === c.key;
        return (
          <Tooltip key={c.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onFilter(on ? "" : c.key)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-0.5 rounded-md border p-card px-3 py-2.5 text-left transition-colors",
                  on
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "text-[22px] font-semibold leading-tight tabular-nums",
                    c.tone,
                  )}
                >
                  {c.value}
                </span>
                <span className="text-[10px] leading-snug text-muted-foreground">
                  {c.label}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px]">
              {c.title}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
