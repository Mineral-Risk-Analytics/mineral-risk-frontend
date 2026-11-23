/**
 * Quality-defect chips — small warning markers for ingest defects recorded on
 * an event (truncated_summary, future_date, no_provenance, no_source_url,
 * needs_material_review, ...). Rendered as labelled chips so a defect is
 * readable at a glance rather than hidden behind an icon.
 */

import { AlertTriangle } from "lucide-react";

const DEFECT_HINTS: Record<string, string> = {
  truncated_summary:
    "Summary sliced at 500 characters on ingest — the full text is not recoverable without re-ingesting the source item",
  future_date: "Event date is in the future",
  no_provenance: "No source document was ever created for this event",
  no_source_url: "Points at a bulk document with no URL",
  needs_material_review:
    "Material links need a human pass before this event can score",
};

function humanizeDefect(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function QualityDefectChips({ defects }: { defects: string[] }) {
  if (!defects.length) return null;

  return (
    <span
      style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}
    >
      {defects.map((d) => (
        <span
          key={d}
          /* The hint goes in `title` (the hover surface) and the visible label
             is what the screen reader gets. These were the other way round:
             hovering repeated the label already on screen, and the one piece
             of explanatory text was reachable only by assistive tech. */
          title={DEFECT_HINTS[d] ?? humanizeDefect(d)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            height: 16,
            padding: "0 6px",
            borderRadius: 3,
            border: "1px solid rgba(217, 119, 6, 0.3)",
            background: "var(--p-risk-mod-soft)",
            color: "#92400E",
            fontSize: 9,
            fontWeight: 600,
            whiteSpace: "nowrap",
            lineHeight: 1,
            cursor: "help",
          }}
        >
          <AlertTriangle size={9} strokeWidth={2.25} />
          {humanizeDefect(d)}
        </span>
      ))}
    </span>
  );
}
