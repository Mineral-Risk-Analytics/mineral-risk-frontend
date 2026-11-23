/**
 * Category cell: suggested vs confirmed.
 *
 * The single most important distinction on this screen. A dashed outline and
 * the word "suggested" mark a machine guess; a solid PillarTag marks a human
 * decision. Rendering them identically would hide whether anyone has looked.
 *
 * Unlike the design mock, supportive/display_only events DO carry a
 * suggested_category in the real API, so the suggestion renders (dashed, with
 * the "suggested" microcopy) even for display_only rows.
 */

import type { CSSProperties } from "react";
import type { TriageEvent } from "@/lib/api/triage";

export interface PillarMeta {
  label: string;
  short: string;
  cssVar: string | null;
}

export const PILLARS: Record<string, PillarMeta> = {
  material_concentration: {
    label: "Material concentration",
    short: "Mat",
    cssVar: "--p-pillar-material",
  },
  geopolitical_trade: {
    label: "Geopolitical trade",
    short: "Geo",
    cssVar: "--p-pillar-geo",
  },
  regulatory_compliance: {
    label: "Regulatory compliance",
    short: "Reg",
    cssVar: "--p-pillar-regulatory",
  },
  operational: {
    label: "Operational",
    short: "Ops",
    cssVar: "--p-pillar-operational",
  },
  financial_pressure: {
    label: "Financial pressure",
    short: "Fin",
    cssVar: "--p-pillar-financial",
  },
};

/** Display order for read-only lists (filters, "pillars affected"). */
export const PILLAR_ORDER = [
  "material_concentration",
  "geopolitical_trade",
  "regulatory_compliance",
  "operational",
  "financial_pressure",
] as const;

/** Order used when ASSIGNING the single scoring pillar. This is the engine's
 *  own precedence, not the display order — the pillar the engine would pick
 *  by default has to be visible first, or the triager reads the selector as an
 *  arbitrary list and loses the "this is what the machine would have done"
 *  signal. Mirrors PRIMARY_CATEGORY_PRECEDENCE in the design system. */
export const PRIMARY_CATEGORY_PRECEDENCE = [
  "operational",
  "geopolitical_trade",
  "regulatory_compliance",
  "financial_pressure",
  "material_concentration",
] as const;

export function pillarMeta(slug: string): PillarMeta {
  return (
    PILLARS[slug] ?? {
      label: slug.replace(/[_-]+/g, " "),
      short: slug.slice(0, 3).toUpperCase(),
      cssVar: null,
    }
  );
}

function pillarColor(slug: string): string {
  const d = pillarMeta(slug);
  return d.cssVar ? "var(" + d.cssVar + ")" : "var(--p-text-muted)";
}

/** Solid outline chip in the pillar's taxonomy colour — a human decision. */
export function PillarChip({
  pillar,
  format = "short",
}: {
  pillar: string;
  format?: "short" | "long";
}) {
  const d = pillarMeta(pillar);
  const color = pillarColor(pillar);

  if (format === "long") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: "var(--p-text-xs, 12px)",
          color,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "var(--p-radius-pill, 999px)",
            background: color,
            flexShrink: 0,
          }}
        />
        {d.label}
      </span>
    );
  }

  return (
    <span
      title={d.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        border: "1px solid " + color,
        borderRadius: 3,
        padding: "1px 5px",
        fontSize: 9.5,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
        color,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "var(--p-radius-pill, 999px)",
          background: color,
          flexShrink: 0,
        }}
      />
      {d.short}
    </span>
  );
}

const microcopy: CSSProperties = { fontSize: 9, color: "var(--p-text-faint)" };

export function CategoryCell({ event }: { event: TriageEvent }) {
  if (event.primary_category) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <PillarChip pillar={event.primary_category} />
        <span style={microcopy}>confirmed</span>
      </div>
    );
  }

  if (event.suggested_category) {
    const d = pillarMeta(event.suggested_category);
    const color = pillarColor(event.suggested_category);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          title={
            "Suggested by the ingest engine: " +
            d.label +
            " — not yet confirmed, so it does not score"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
            height: "var(--p-badge-h, 20px)",
            padding: "0 7px",
            borderRadius: 3,
            border: "1px dashed " + color,
            color,
            background: "transparent",
            fontSize: "var(--p-text-2xs, 11px)",
            fontWeight: 500,
            whiteSpace: "nowrap",
            lineHeight: 1,
            cursor: "help",
          }}
        >
          {d.short}
        </span>
        <span style={microcopy}>
          {event.triage_status === "display_only"
            ? "suggested · display only"
            : "suggested"}
        </span>
      </div>
    );
  }

  if (event.triage_status === "display_only") {
    return (
      <span
        style={{ fontSize: "var(--p-text-xs, 12px)", color: "var(--p-text-faint)" }}
      >
        none — display only
      </span>
    );
  }

  return (
    <span
      title="No category suggested — needs one before it can score"
      style={{
        fontSize: "var(--p-text-xs, 12px)",
        fontStyle: "italic",
        color: "var(--p-text-faint)",
      }}
    >
      no suggestion
    </span>
  );
}
