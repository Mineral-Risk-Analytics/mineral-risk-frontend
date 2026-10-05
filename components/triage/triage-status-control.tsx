"use client";

/**
 * The triage decision: the three terminal states an event can be moved to
 * from `pending_triage`, plus the reverse move back to the queue.
 *
 *   scoring       — confirmed; feeds every display surface and the shadow
 *                   event pillars (5.0 concentration-first launch: those
 *                   pillars are weight 0 in the published score until the
 *                   re-promotion gates clear — confirming builds the
 *                   validation record, it does not move published numbers)
 *   display_only  — industry-relevant and viewable, but attributed to no
 *                   material or pillar for scoring
 *   rejected      — soft dismiss; row retained so dedupe cannot resurrect it
 *
 * Every transition is reversible (un-approve, un-dismiss), so this renders
 * as a selectable group rather than one-way action buttons.
 */

import { CheckCircle2, Eye, XCircle, type LucideIcon } from "lucide-react";
import type { TriageStatus } from "@/lib/api/triage";

interface Outcome {
  value: TriageStatus;
  label: string;
  icon: LucideIcon;
  color: string;
  fill: string;
  ink: string;
  title: string;
}

const OUTCOMES: Outcome[] = [
  {
    value: "scoring",
    label: "Approve",
    icon: CheckCircle2,
    color: "var(--p-risk-low)",
    fill: "var(--p-risk-low-soft)",
    ink: "#065F46",
    title: "Confirm — feeds the content feed and the validation record (event pillars are shadow-scored until re-promotion)",
  },
  {
    value: "display_only",
    label: "Display only",
    icon: Eye,
    color: "var(--p-text-muted)",
    fill: "var(--p-bg-muted)",
    ink: "var(--p-text)",
    title: "Industry-relevant and shown in the feed, but not scored",
  },
  {
    value: "rejected",
    label: "Dismiss",
    icon: XCircle,
    color: "var(--p-risk-crit)",
    fill: "var(--p-risk-crit-soft)",
    ink: "#9F1239",
    title: "Soft dismiss — hidden everywhere, kept so dedupe cannot resurrect it",
  },
];

export interface TriageStatusControlProps {
  status: TriageStatus;
  onChange: (next: TriageStatus) => void;
  size?: "sm" | "default";
  pending?: boolean;
  disallow?: TriageStatus[];
  disallowReason?: string;
}

export function TriageStatusControl({
  status,
  onChange,
  size = "default",
  pending,
  disallow,
  disallowReason,
}: TriageStatusControlProps) {
  const h = size === "sm" ? 26 : "var(--p-control-h, 32px)";
  const fs =
    size === "sm" ? "var(--p-text-2xs, 11px)" : "var(--p-text-xs, 12px)";

  return (
    <div
      role="radiogroup"
      aria-label="Triage decision"
      aria-busy={pending || undefined}
      style={{
        display: "inline-flex",
        borderRadius: "var(--p-radius-md)",
        border: "1px solid var(--p-border)",
        overflow: "hidden",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {OUTCOMES.map((o, i) => {
        const on = status === o.value;
        /* Some outcomes are refused by the backend for certain events — a
           positive-direction subtype cannot be promoted to scoring, because
           it is excluded from risk arithmetic and would contribute nothing.
           Render the option disabled with the reason rather than hiding it:
           the triager needs to see that approving is not an option here. */
        const blocked = !on && Array.isArray(disallow) && disallow.includes(o.value);
        const IconGlyph = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={pending || blocked}
            title={
              blocked
                ? disallowReason || "Not available for this event"
                : on
                  ? o.title + " — click again to return to the queue"
                  : o.title
            }
            /* Clicking the active outcome returns the event to pending_triage,
               which is how un-approve and un-dismiss are reached. */
            onClick={() => {
              if (!blocked) onChange(on ? "pending_triage" : o.value);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: h,
              padding: size === "sm" ? "0 8px" : "0 11px",
              border: "none",
              borderRight:
                i === OUTCOMES.length - 1 ? "none" : "1px solid var(--p-border)",
              background: on
                ? o.fill
                : blocked
                  ? "var(--p-bg-subtle)"
                  : "var(--p-card)",
              color: on
                ? o.ink
                : blocked
                  ? "var(--p-text-faint)"
                  : "var(--p-text-muted)",
              fontFamily: "var(--p-font-sans)",
              fontSize: fs,
              fontWeight: on ? 600 : 500,
              whiteSpace: "nowrap",
              cursor: blocked ? "not-allowed" : pending ? "default" : "pointer",
              transition:
                "background var(--p-dur, 120ms) var(--p-ease, ease), color var(--p-dur, 120ms) var(--p-ease, ease)",
            }}
          >
            <IconGlyph
              size={size === "sm" ? 12 : 14}
              color={on ? o.color : "currentColor"}
              strokeWidth={2}
            />
            {size === "sm" && !on ? null : o.label}
          </button>
        );
      })}
    </div>
  );
}
