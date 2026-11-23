/**
 * Link summary for the table — how many links are confirmed (what scoring
 * reads) versus still suggested (contributing nothing), plus the first two
 * entity labels and an overflow count.
 */

import type { TriageLink } from "@/lib/api/triage";

export function LinksCell({ links }: { links: TriageLink[] }) {
  const confirmed = links.filter((l) => l.status === "confirmed");
  const suggested = links.filter((l) => l.status === "suggested");

  if (!links.length) {
    return (
      <span
        title="No entity links — this event cannot contribute to any pillar score"
        style={{
          fontSize: "var(--p-text-xs, 12px)",
          fontStyle: "italic",
          color: "var(--p-text-faint)",
        }}
      >
        Unattributed
      </span>
    );
  }

  const shown = confirmed.length ? confirmed : suggested;
  const names = shown
    .slice(0, 2)
    .map((l) => l.label)
    .join(", ");
  const extra = shown.length - 2;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 220 }}
    >
      <span
        style={{
          fontSize: "var(--p-text-xs, 12px)",
          color: "var(--p-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {names}
        {extra > 0 ? " +" + extra : ""}
      </span>
      <span
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9.5 }}
      >
        {confirmed.length > 0 && (
          <span
            title={
              confirmed.length +
              " confirmed link" +
              (confirmed.length === 1 ? "" : "s") +
              " — these are what scoring reads"
            }
            style={{ color: "#065F46", fontWeight: 600 }}
          >
            {confirmed.length} confirmed
          </span>
        )}
        {suggested.length > 0 && (
          <span
            title={
              suggested.length +
              " suggested link" +
              (suggested.length === 1 ? "" : "s") +
              " awaiting review — contributing nothing until confirmed"
            }
            style={{ color: "var(--p-risk-mod)", fontWeight: 600 }}
          >
            {suggested.length} suggested
          </span>
        )}
      </span>
    </div>
  );
}
