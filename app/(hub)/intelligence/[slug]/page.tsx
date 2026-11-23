"use client";

/**
 * Public insight-post article — /intelligence/[slug].
 * Single layout serves all four content types (analysis / signal / report /
 * news); type chip color changes but the rest of the layout is shared
 * (Nicole 2026-07-19). Reports additionally surface a PDF download when
 * pdf_url is set.
 *
 * Wine + Stone hub renderer (HubArticleRenderer) — do NOT reuse the admin
 * ArticleRenderer here; it's Cool Slate/shadcn-themed and would drift.
 *
 * Public API GET /intelligence/posts/{slug} only returns status='published'
 * (drafts / archived → 404).
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/hub/Nav";
import { Breadcrumb } from "@/components/hub/entity/Breadcrumb";
import { Footer } from "@/components/hub/Footer";
import { HubArticleRenderer } from "@/components/hub/HubArticleRenderer";
import {
  getPublicPost,
  type PublicInsightPost,
  type ContentType,
} from "@/lib/api/hub-insights";
import { pillarInfo } from "@/components/hub/pillars";
import { SignalList } from "@/components/hub/SignalList";
import { SkeletonArticle } from "@/components/hub/Skeleton";
import { listPublicEvents, type PublicEventItem } from "@/lib/api/entities";

const TYPE_LABEL: Record<ContentType, string> = {
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

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<PublicInsightPost | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );

  // Related signals: automatic material-tag association (2026-10-06
  // interlinking decision) — recent triaged events sharing this article's
  // materials. Self-maintaining: triage an event and it appears under
  // every relevant article; no curation required.
  const [signals, setSignals] = useState<PublicEventItem[]>([]);

  useEffect(() => {
    if (!params?.slug) return;
    getPublicPost(params.slug)
      .then((p) => {
        setPost(p);
        setState("ready");
        const mats = (p.materials ?? []).slice(0, 2);
        if (!mats.length) return;
        Promise.all(
          mats.map((m) => listPublicEvents({ material: m, limit: 4 })),
        )
          .then((pages) => {
            const seen = new Set<number>();
            const merged: PublicEventItem[] = [];
            for (const pg of pages) {
              for (const ev of pg.data) {
                if (!seen.has(ev.id)) {
                  seen.add(ev.id);
                  merged.push(ev);
                }
              }
            }
            merged.sort((a, b) =>
              (b.event_date ?? "").localeCompare(a.event_date ?? ""),
            );
            setSignals(merged.slice(0, 6));
          })
          .catch(() => setSignals([]));
      })
      .catch((e: Error) => setState(e.message === "404" ? "missing" : "error"));
  }, [params?.slug]);

  if (state !== "ready" || !post) {
    return (
      <div className="ih-page">
        <Nav section="intelligence" />
        <main className="ih-entity-main">
          {state === "loading" ? (
            <SkeletonArticle />
          ) : (
            <div className="ih-browse-meta">
              {state === "missing"
                ? "Article not found."
                : "Couldn't load this article — try again shortly."}
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  const typeLabel = TYPE_LABEL[post.content_type];
  const pillar =
    post.pillar ? (pillarInfo(post.pillar)?.label ?? post.pillar) : null;
  const dateStr = formatDate(post.published_at);

  return (
    <div className="ih-page">
      <Nav section="intelligence" />
      <main className="ih-entity-main">
        <Breadcrumb
          trail={[
            { label: "Intelligence", href: "/intelligence" },
            { label: typeLabel, href: "/intelligence" },
            { label: post.title },
          ]}
        />

        <article className="ih-article">
          <header className="ih-article-head">
            <div className="ih-article-eyebrow">
              <span
                className={`ih-article-type ih-article-type--${post.content_type}`}
              >
                {typeLabel}
              </span>
              {post.risk_band ? (
                <span
                  className={`ih-tag ih-risk-tag ih-mat-level-${post.risk_band}`}
                  title="Editorial risk severity assigned by the author"
                >
                  {{ low: "Low risk", med: "Med risk", high: "High risk", crit: "Critical risk" }[post.risk_band]}
                </span>
              ) : null}
              {dateStr ? (
                <span className="ih-article-date">{dateStr}</span>
              ) : null}
              {post.read_time_minutes ? (
                <span className="ih-article-read">
                  {post.read_time_minutes} min read
                </span>
              ) : null}
            </div>

            <h1 className="ih-article-title">{post.title}</h1>

            {post.summary ? (
              <p className="ih-article-lede">{post.summary}</p>
            ) : null}

            <div className="ih-article-meta">
              {post.author ? (
                <span className="ih-article-byline">By {post.author}</span>
              ) : null}
              {pillar ? (
                <span className="ih-article-pillar">Pillar · {pillar}</span>
              ) : null}
            </div>

            {(post.materials?.length || post.geographies?.length) ? (
              <div className="ih-article-tags">
                {(post.materials ?? []).map((m) => (
                  <span key={`m-${m}`} className="ih-tag ih-tag-mat">
                    {m}
                  </span>
                ))}
                {(post.geographies ?? []).map((g) => (
                  <span key={`g-${g}`} className="ih-tag ih-tag-geo">
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          {post.hero_image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.hero_image_url}
              alt=""
              className="ih-article-hero"
            />
          ) : null}

          {post.content_type === "report" && post.pdf_url ? (
            <a
              href={post.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="ih-article-pdf"
            >
              Download PDF ↓
            </a>
          ) : null}

          {post.body ? (
            <HubArticleRenderer body={post.body} />
          ) : (
            <p className="ih-empty-note">
              This article hasn&rsquo;t been published with body content yet.
            </p>
          )}

          {post.entity_links && post.entity_links.length ? (
            <aside className="ih-article-entities">
              <div className="ih-eyebrow">Referenced in this analysis</div>
              <div className="ih-article-entity-list">
                {post.entity_links.map((e) => (
                  <Link
                    key={`${e.kind}-${e.label}`}
                    href={e.url}
                    className="ih-entity-link"
                  >
                    <span className="ih-entity-link-kind">
                      {e.kind === "company" ? "Company" : "Regulation"}
                    </span>
                    <span className="ih-entity-link-label">{e.label}</span>
                    <span className="ih-entity-link-arrow">→</span>
                  </Link>
                ))}
              </div>
            </aside>
          ) : null}

          <footer className="ih-article-foot">
            <Link href="/intelligence" className="ih-article-back">
              ← Back to Intelligence
            </Link>
          </footer>
        </article>

        {signals.length ? (
          <section className="ih-article" style={{ marginTop: 28 }}>
            <div className="ih-section-head">
              <h2 className="ih-section-title">Related signals</h2>
              <span className="ih-section-aside">
                tracked events for this article&rsquo;s materials
              </span>
            </div>
            <SignalList items={signals} />
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
