/**
 * "Linked intelligence" on entity pages — un-hidden 2026-07-22 now that
 * the tag picker + the tags-PATCH fix make entity tags reliable. Posts
 * arrive tag-matched server-side (_tagged_posts: exact canonical_name /
 * regulation_key match, newest 6). Renders nothing when no coverage —
 * an empty section reads as a gap, absence doesn't.
 * linked_events stays hidden until the Phase-5 flag flips.
 */

import { FeedRow } from "@/components/hub/FeedRow";
import { Section } from "./Section";
import { pillarInfo } from "@/components/hub/pillars";
import type { LinkedPostOut } from "@/lib/api/entities";
import type { ContentType, FeedPost } from "@/components/hub/types";

const TYPE_LABEL: Record<string, ContentType> = {
  analysis: "Analysis",
  signal: "Signal",
  report: "Report",
  news: "News",
};

function toFeedPost(p: LinkedPostOut): FeedPost {
  return {
    id: p.slug,
    slug: p.slug,
    type: TYPE_LABEL[p.content_type] ?? "Analysis",
    materials: p.materials ?? [],
    geographies: p.geographies ?? [],
    pillar: p.pillar ? (pillarInfo(p.pillar)?.label ?? p.pillar) : undefined,
    date: p.published_at
      ? new Date(p.published_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "",
    read: p.read_time_minutes ?? undefined,
    title: p.title,
    preview: p.summary ?? undefined,
  };
}

export function LinkedPostsSection({ posts }: { posts: LinkedPostOut[] }) {
  if (!posts.length) return null;
  return (
    <Section
      title="Linked intelligence"
      aside={`${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
    >
      <div className="ih-linked-feed">
        {posts.map((p) => (
          <FeedRow key={p.slug} row={toFeedPost(p)} />
        ))}
      </div>
    </Section>
  );
}

/**
 * Related events — the Phase-5 flag, flipped 2026-10-24: post-reset the
 * corpus is repaired (correct dates, validated geographies), so entity
 * pages now show the triaged events the API has carried all along.
 * Severity is in the payload but deliberately NOT rendered — public
 * scope is bands + dates (A6).
 */
import type { LinkedEventOut } from "@/lib/api/entities";

function eventDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LinkedEventsSection({ events }: { events: LinkedEventOut[] }) {
  if (!events.length) return null;
  return (
    <Section
      title="Related events"
      aside={`${events.length} tracked`}
      note="Trade measures and developments we track that touch this entity — shown for context, not folded into any rating."
    >
      <div className="ih-linkedev-list">
        {events.map((e, i) => (
          <div key={i} className="ih-linkedev-row">
            <span className="ih-linkedev-date">{eventDate(e.event_date)}</span>
            <span className="ih-linkedev-title">{e.title}</span>
            <span className="ih-linkedev-type">
              {(e.event_subtype ?? e.event_type).replaceAll("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
