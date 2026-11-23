"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline notice banner for the concentration surfaces. Amber = a data-coverage
 * finding the analyst should act on; slate = neutral context. Kept deliberately
 * plain — these carry findings, not decoration.
 */
export function Notice({
  tone = "amber",
  children,
}: {
  tone?: "amber" | "slate";
  children: ReactNode;
}) {
  const Icon = tone === "amber" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-xs leading-relaxed",
        tone === "amber"
          ? "border-amber-500/30 bg-amber-100/60 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
