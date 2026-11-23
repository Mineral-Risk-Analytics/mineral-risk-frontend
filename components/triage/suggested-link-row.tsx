"use client";

/**
 * One machine-suggested entity link, with the evidence for it and the two
 * decisions a triager can make. Links arrive as `suggested`; scoring reads
 * only `confirmed` ones. Rejecting is reversible.
 *
 * match_reason is the engine's own vocabulary — hs_code, keyword_match,
 * named_company, facility_link, facility_operator, watchlist_query,
 * company_material_exposure, country_production_concentration,
 * trade_flow_match, triage_attach — and is shown verbatim because "why did
 * the machine think this?" is the question the triager is answering.
 */

import { Check, X, type LucideIcon } from "lucide-react";
import type { LinkStatus, TriageLink } from "@/lib/api/triage";

const REASON_HINTS: Record<string, string> = {
  hs_code: "Matched on an HS code mapped to this material",
  keyword_match: "Matched a keyword in the source text",
  named_company: "The company is named in the source text",
  facility_link: "Inherited from a linked facility",
  facility_operator: "The company operates a linked facility",
  facility_name_match: "The facility name appears in the source text",
  watchlist_query: "Captured by a standing watchlist query",
  company_material_exposure:
    "Derived from the company's material exposure profile",
  country_production_concentration:
    "Derived from the country's production concentration",
  trade_flow_match: "Matched on a trade flow record",
  regulation_unspecified: "Regulation named without a specific material scope",
  triage_attach: "Attached by an analyst during triage",
};

interface StateStyle {
  border: string;
  background: string;
  ink: string;
}

const STATE: Record<LinkStatus, StateStyle> = {
  suggested: {
    border: "var(--p-border)",
    background: "var(--p-card)",
    ink: "var(--p-text)",
  },
  confirmed: {
    border: "rgba(5, 150, 105, 0.35)",
    background: "var(--p-risk-low-soft)",
    ink: "#065F46",
  },
  rejected: {
    border: "var(--p-border)",
    background: "var(--p-bg-subtle)",
    ink: "var(--p-text-faint)",
  },
};

function DecisionButton({
  icon: IconGlyph,
  label,
  active,
  activeColor,
  onClick,
  title,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: "var(--p-radius-sm)",
        border: "1px solid " + (active ? activeColor : "var(--p-border)"),
        background: active ? activeColor : "var(--p-card)",
        color: active ? "#fff" : "var(--p-text-muted)",
        cursor: disabled ? "default" : "pointer",
        transition:
          "background var(--p-dur, 120ms) var(--p-ease, ease), border-color var(--p-dur, 120ms) var(--p-ease, ease), color var(--p-dur, 120ms) var(--p-ease, ease)",
      }}
    >
      <IconGlyph size={13} strokeWidth={2.25} />
    </button>
  );
}

export interface SuggestedLinkRowProps {
  link: TriageLink;
  onSetStatus: (linkId: number, next: LinkStatus) => void;
  pending?: boolean;
}

export function SuggestedLinkRow({
  link,
  onSetStatus,
  pending,
}: SuggestedLinkRowProps) {
  const s = STATE[link.status] ?? STATE.suggested;
  const rejected = link.status === "rejected";
  const pct =
    link.relevance_score == null ? null : Math.round(link.relevance_score * 100);

  return (
    <div
      aria-busy={pending || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: "var(--p-radius-md)",
        border: "1px solid " + s.border,
        background: s.background,
        opacity: pending ? 0.6 : 1,
        transition:
          "background var(--p-dur, 120ms) var(--p-ease, ease), border-color var(--p-dur, 120ms) var(--p-ease, ease)",
      }}
    >
      <div
        style={{
          minWidth: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: "var(--p-text-xs, 12px)",
            fontWeight: 500,
            color: s.ink,
            textDecoration: rejected ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {link.label}
        </span>
        <span
          title={
            (link.match_reason && REASON_HINTS[link.match_reason]) ||
            "Assignment provenance recorded at ingest"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 9.5,
            color: "var(--p-text-muted)",
            cursor: "help",
          }}
        >
          <span style={{ fontFamily: "var(--p-font-mono)" }}>
            {link.match_reason ?? "—"}
          </span>
          {!link.is_direct && (
            <span
              title="Indirect — inherited through another entity rather than named in the source"
              style={{ color: "var(--p-text-faint)" }}
            >
              · indirect
            </span>
          )}
        </span>
      </div>

      {pct != null && (
        <span
          title="Suggested relevance weight — machine-assigned, not editable in triage v1"
          style={{
            flexShrink: 0,
            fontFamily: "var(--p-font-mono)",
            fontSize: "var(--p-text-2xs, 11px)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--p-text-muted)",
            cursor: "help",
          }}
        >
          {pct}%
        </span>
      )}

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <DecisionButton
          icon={Check}
          label="Confirm link"
          title={
            link.status === "confirmed"
              ? "Confirmed — click to return to suggested"
              : "Confirm this link"
          }
          active={link.status === "confirmed"}
          activeColor="var(--p-risk-low)"
          disabled={pending}
          onClick={() =>
            onSetStatus(
              link.id,
              link.status === "confirmed" ? "suggested" : "confirmed",
            )
          }
        />
        <DecisionButton
          icon={X}
          label="Reject link"
          title={
            rejected ? "Rejected — click to return to suggested" : "Reject this link"
          }
          active={rejected}
          activeColor="var(--p-risk-crit)"
          disabled={pending}
          onClick={() =>
            onSetStatus(link.id, rejected ? "suggested" : "rejected")
          }
        />
      </div>
    </div>
  );
}
