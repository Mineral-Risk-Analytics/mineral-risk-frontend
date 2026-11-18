"use client";

/**
 * Public intelligence hub feed — wired to the live API (2026-07-08),
 * replacing the design-phase mock arrays.
 *
 * Ordering (decided 2026-07-08):
 *   1. Featured Report slot = latest published `report`-type post, by
 *      convention (no schema flag). Hidden entirely until one exists.
 *   2. Pinned posts (analysis/signal/news) — API orders pinned first;
 *      rendered with a "Pinned" chip.
 *   3. Date-ordered feed (published_at DESC).
 * Tab filtering is client-side over one fetch (feed ≤ ~50 posts at launch).
 * Public route — unauthenticated fetch, no Clerk dependency.
 *
 * Tab taxonomy (2026-11-18, Nicole): the LIVE SIGNALS feed lives under
 * the SIGNAL tab (with any authored signal posts above it) — News is
 * purely curated external coverage we author. Tabs with no content are
 * hidden entirely: while loading only "All" shows, and populated tabs
 * appear as data arrives. Signals are fetched eagerly (not lazily) since
 * tab visibility depends on them.
 */

import { useEffect, useState } from "react";
import { Nav }            from "@/components/hub/Nav";
import { FeaturedReport } from "@/components/hub/FeaturedReport";
import { FeedRow }        from "@/components/hub/FeedRow";
import { Sidebar }        from "@/components/hub/Sidebar";
import { TypeLegend }     from "@/components/hub/TypeLegend";
import { Footer }         from "@/components/hub/Footer";
import type { TabLabel, FeedPost, FeaturedPost, ContentType } from "@/components/hub/types";
import { pillarInfo } from "@/components/hub/pillars";
import { SignalList } from "@/components/hub/SignalList";
import { SkeletonFeedRows } from "@/components/hub/Skeleton";
import { listPublicEvents, type PublicEventItem } from "@/lib/api/entities";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** API shape — mirrors InsightPostListItem (app/schemas/intelligence.py). */
interface ApiPost {
  id: number;
  slug: string;
  title: string;
  content_type: "analysis" | "signal" | "report" | "news";
  materials: string[] | null;
  geographies: string[] | null;
  summary: string | null;
  read_time_minutes: number | null;
  published_at: string | null;
  pinned: boolean;
  tags: string[] | null;
  pillar: string | null;
  risk_band: "low" | "med" | "high" | "crit" | null;
}

const TYPE_LABEL: Record<ApiPost["content_type"], ContentType> = {
  analysis: "Analysis",
  signal: "Signal",
  report: "Report",
  news: "News",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toFeedPost(p: ApiPost): FeedPost {
  return {
    id: String(p.id),
    slug: p.slug,
    type: TYPE_LABEL[p.content_type],
    materials: p.materials ?? [],
    geographies: p.geographies ?? [],
    tags: p.tags ?? [],
    pillar: p.pillar ? (pillarInfo(p.pillar)?.label ?? p.pillar) : undefined,
    riskBand: p.risk_band ?? undefined,
    date: formatDate(p.published_at),
    pinned: p.pinned,
    read: p.read_time_minutes ?? undefined,
    title: p.title,
    preview: p.summary ?? undefined,
  };
}

function toFeatured(p: ApiPost): FeaturedPost {
  return {
    type: "Report",
    materials: p.materials ?? [],
    geographies: p.geographies ?? [],
    date: formatDate(p.published_at),
    title: p.title,
    lede: p.summary ?? "",
    // Real posts carry no callout metrics yet — FeaturedReport guards this.
    callouts: [],
    ctaLabel: "Read →",
    ctaHref: `/intelligence/${p.slug}`,
  };
}

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<TabLabel>("All");
  const [posts, setPosts] = useState<ApiPost[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/intelligence/posts?limit=50`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setPosts(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live signals (C3) — shown under the SIGNAL tab. Fetched eagerly on
  // mount: the Signal tab's visibility depends on whether any exist.
  const [signals, setSignals] = useState<PublicEventItem[] | null>(null);
  useEffect(() => {
    let live = true;
    listPublicEvents({ limit: 15 })
      .then((res) => {
        if (live) setSignals(res.data);
      })
      .catch(() => {
        if (live) setSignals([]); // quiet failure — the section is simply absent
      });
    return () => {
      live = false;
    };
  }, []);

  // Featured = latest published report (API is date-ordered within types;
  // reports can't be pinned so the first report row is the latest one).
  const featuredApi = (posts ?? []).find((p) => p.content_type === "report");
  const featured = featuredApi ? toFeatured(featuredApi) : null;

  const feed: FeedPost[] = (posts ?? [])
    .filter((p) => p.id !== featuredApi?.id)
    .map(toFeedPost);

  const visibleFeed =
    activeTab === "All" ? feed : feed.filter((p) => p.type === activeTab);

  // Hide tabs with nothing behind them (2026-11-18): "All" always shows;
  // a content-type tab appears once a post of that type exists (featured
  // report counts for Report); Signal also counts the live-signals feed.
  // While loading, only "All" renders — populated tabs appear additively.
  const hasType = (t: TabLabel) =>
    feed.some((p) => p.type === t) || (t === "Report" && featured !== null);
  const visibleTabs: TabLabel[] = ["All"];
  if (posts !== null || error) {
    for (const t of ["Analysis", "Signal", "Report", "News"] as TabLabel[]) {
      if (hasType(t) || (t === "Signal" && (signals?.length ?? 0) > 0)) {
        visibleTabs.push(t);
      }
    }
  }

  return (
    <>
      <Nav activeTab={activeTab} onTab={setActiveTab} tabs={visibleTabs} />

      <main className="ih-main">
        <div className="ih-content">
          <TypeLegend />

          <div className="ih-body">
            {/* Main feed column */}
            <div className="ih-feed-col">
              {featured && (activeTab === "All" || activeTab === "Report") ? (
                <section className="ih-feed-section">
                  <div className="ih-section-h">
                    <span className="ih-eyebrow">Featured Report</span>
                  </div>
                  <FeaturedReport post={featured} />
                </section>
              ) : null}

              {activeTab === "Signal" && visibleFeed.length === 0 ? null : (
              <section className="ih-feed-section">
                <div className="ih-section-h">
                  <span className="ih-eyebrow">Recent Intelligence</span>
                  {visibleFeed.length ? (
                    <span className="ih-section-count">
                      {visibleFeed.length} {visibleFeed.length === 1 ? "item" : "items"}
                    </span>
                  ) : null}
                </div>

                <div className="ih-recent-list">
                  {visibleFeed.map((row) => (
                    <FeedRow key={row.id} row={row} />
                  ))}

                  {posts === null && !error ? (
                    <SkeletonFeedRows rows={5} />
                  ) : null}
                  {error ? (
                    <p className="ih-feed-note">
                      The feed is temporarily unavailable — please check back shortly.
                    </p>
                  ) : null}
                  {posts !== null && !error && visibleFeed.length === 0 && !featured ? (
                    <p className="ih-feed-note">
                      No {activeTab === "All" ? "" : activeTab + " "}posts yet — check back soon.
                    </p>
                  ) : null}
                </div>
              </section>
              )}

              {activeTab === "Signal" && signals && signals.length > 0 ? (
                <section className="ih-feed-section">
                  <div className="ih-section-h">
                    <span className="ih-eyebrow">Live signals</span>
                    <span className="ih-section-count">
                      from our tracking engine
                    </span>
                  </div>
                  <SignalList items={signals} />
                </section>
              ) : null}
            </div>

            {/* Sidebar */}
            <Sidebar />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
