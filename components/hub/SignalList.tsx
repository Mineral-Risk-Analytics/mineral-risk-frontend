/**
 * Live signals — rows of triaged risk events for public surfaces
 * (C3/C4, 2026-10-24).
 *
 * One renderer for every signal surface: the News-tab stream, material
 * profiles, and article "Related signals". Events are DATA, visually
 * distinct from editorial feed rows: date + source attribution + title +
 * material links, with a quiet "Confirmed" tick on human-verified rows
 * (C1 vocabulary: these are live signals beside the structural rating,
 * not components of it). No numeric severity anywhere — public scope is
 * bands and dates (A6).
 *
 * Material chips link to /intelligence/materials/{slug} — part of the
 * interlinking pass (every surface links onward).
 */

import Link from "next/link";
import { materialSlug, type PublicEventItem } from "@/lib/api/entities";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function SignalRow({ item }: { item: PublicEventItem }) {
  const geo = item.geographies
    .map((g) => g.name ?? g.code)
    .slice(0, 3)
    .join(", ");
  return (
    <div className="ih-signal-row">
      <div className="ih-signal-meta">
        <span className="ih-signal-date">{formatDate(item.event_date)}</span>
        {item.verified ? (
          <span
            className="ih-signal-verified"
            title="Confirmed by our analysts"
          >
            ✓ Confirmed
          </span>
        ) : null}
        {item.direction === "supportive" ? (
          <span className="ih-signal-supportive" title="Supply-supportive development">
            Supportive
          </span>
        ) : null}
      </div>
      <div className="ih-signal-title">
        {item.source_url ? (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ih-signal-link"
          >
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </div>
      {item.summary ? <p className="ih-signal-summary">{item.summary}</p> : null}
      <div className="ih-signal-tags">
        {item.materials.map((m) => (
          <Link
            key={m}
            href={`/intelligence/materials/${materialSlug(m)}`}
            className="ih-tag ih-signal-mat"
          >
            {m}
          </Link>
        ))}
        {geo ? <span className="ih-signal-geo">{geo}</span> : null}
        {item.source_name ? (
          <span className="ih-signal-src">{item.source_name}</span>
        ) : null}
      </div>
    </div>
  );
}

export function SignalList({ items }: { items: PublicEventItem[] }) {
  if (!items.length) return null;
  return (
    <div className="ih-signal-list">
      {items.map((e) => (
        <SignalRow key={e.id} item={e} />
      ))}
    </div>
  );
}
