"use client";

/**
 * Public material profile — /intelligence/materials/[slug] (Piece C,
 * 2026-10-24). The launch centerpiece page:
 *
 *   masthead     band chip + as-of date (the public headline is the BAND)
 *   stages       the concentration story from citable source data — the
 *                scorer's own per-stage share selection, driving stage
 *                marked, source + data year on every stage
 *   signals      C4: the live-signals feed filtered to this material
 *   regulations  material-scoped registry rows → regulation pages
 *   posts        tagged analysis → article pages
 *
 * Interlinking: every block links onward (regulations, articles, source
 * permalinks, methodology), per the 2026-10-06 interlinking decision.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Nav } from "@/components/hub/Nav";
import { Footer } from "@/components/hub/Footer";
import { Breadcrumb } from "@/components/hub/entity/Breadcrumb";
import { Section } from "@/components/hub/entity/Section";
import { LinkedPostsSection } from "@/components/hub/entity/LinkedPosts";
import { SignalList } from "@/components/hub/SignalList";
import { SkeletonProfile } from "@/components/hub/Skeleton";
import { SubscribeBox } from "@/components/hub/SubscribeBox";
import {
  getPublicMaterial,
  listPublicEvents,
  type PublicEventItem,
  type PublicMaterialProfile,
} from "@/lib/api/entities";

const STAGE_LABEL: Record<string, string> = {
  ore: "Mining",
  concentrate: "Concentrate",
  intermediate: "Intermediate processing",
  refined: "Refining",
  battery_grade: "Battery-grade conversion",
};

function formatAsOf(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function StageBlock({
  stage,
}: {
  stage: PublicMaterialProfile["stages"][number];
}) {
  return (
    <div className="ih-stage-block">
      <div className="ih-stage-head">
        <span className="ih-stage-name">
          {STAGE_LABEL[stage.stage] ?? stage.stage}
          {stage.is_driving ? (
            <span
              className="ih-stage-driving"
              title="The most concentrated stage — it sets this material's rating"
            >
              sets the rating
            </span>
          ) : null}
        </span>
        <span className="ih-stage-src">
          {stage.sources.join(" · ")} · {stage.reference_year}
        </span>
      </div>
      <div className="ih-stage-shares">
        {stage.shares.map((s) => (
          <div key={s.code} className="ih-mat-row">
            <span className="ih-mat-name" title={s.name ?? s.code}>
              {s.name ?? s.code}
            </span>
            <div className="ih-mat-track">
              <div
                className="ih-mat-fill ih-share-fill"
                style={{ width: `${Math.min(100, s.share * 100)}%` }}
              />
            </div>
            <span className="ih-mat-level ih-share-pct">
              {Math.round(s.share * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MaterialProfilePage() {
  const params = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicMaterialProfile | null>(null);
  const [events, setEvents] = useState<PublicEventItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!params?.slug) return;
    let live = true;
    // Profile and signals in PARALLEL (2026-11-12): the events endpoint
    // takes the slug directly now, so the C4 feed no longer waits for
    // the profile fetch to learn the material's name.
    getPublicMaterial(params.slug)
      .then((p) => {
        if (!live) return;
        setProfile(p);
        setState("ready");
      })
      .catch((e: Error) =>
        setState(e.message === "404" ? "missing" : "error"),
      );
    listPublicEvents({ material_slug: params.slug, limit: 8 })
      .then((ev) => {
        if (live) setEvents(ev.data);
      })
      .catch(() => {
        if (live) setEvents([]); // quiet failure — the section is absent
      });
    return () => {
      live = false;
    };
  }, [params?.slug]);

  if (state !== "ready" || !profile) {
    return (
      <div className="ih-page">
        <Nav section="materials" />
        <main className="ih-entity-main">
          {state === "loading" ? (
            <SkeletonProfile />
          ) : (
            <div className="ih-browse-meta">
              {state === "missing"
                ? "Material not found."
                : "Couldn't load this material — try again shortly."}
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="ih-page">
      <Nav section="materials" />
      <main className="ih-entity-main">
        <Breadcrumb
          trail={[
            { label: "Intelligence", href: "/intelligence" },
            { label: "Materials", href: "/intelligence/materials" },
            { label: profile.name },
          ]}
        />

        <header className="ih-entity-head">
          <div className="ih-entity-head-main">
            <div className="ih-eyebrow">Material</div>
            <h1 className="ih-entity-title">{profile.name}</h1>
            <div className="ih-entity-sub">
              <span
                className={`ih-tag ih-risk-tag ih-mat-level-${profile.band.level}`}
                title="Structural supply risk band"
              >
                {profile.band.label} structural supply risk
              </span>
              {profile.as_of_date ? (
                <span className="ih-mat-asof" style={{ marginLeft: 10 }}>
                  as of {formatAsOf(profile.as_of_date)}
                </span>
              ) : null}{" "}
              <Link href="/intelligence/methodology" className="ih-aside-link">
                How this rating works →
              </Link>
            </div>
          </div>
        </header>

        <div className="ih-entity-grid">
          <div className="ih-entity-col">
            {profile.stages.length ? (
              <Section
                title="Where supply is concentrated"
                note="Country shares of production by processing stage, from the same cited sources the rating is computed on. The most concentrated stage sets the rating."
              >
                {profile.stages.map((s) => (
                  <StageBlock key={s.stage} stage={s} />
                ))}
              </Section>
            ) : null}

            {events.length ? (
              <Section
                title="Live signals"
                aside={`${profile.linked_event_count} tracked`}
                note="Export measures, policy changes, and disruptions we track for this material. Signals are shown alongside the rating — they are not yet folded into it."
              >
                <SignalList items={events} />
              </Section>
            ) : null}

            {profile.regulations.length ? (
              <Section title="Regulations in force" aside={`${profile.regulations.length}`}>
                <div className="ih-matreg-list">
                  {profile.regulations.map((r) => (
                    <Link
                      key={r.regulation_key}
                      href={`/intelligence/regulations/${r.regulation_key}`}
                      className="ih-matreg-row"
                    >
                      <span className="ih-matreg-title">
                        {r.title ?? r.regulation_key}
                      </span>
                      <span className="ih-matreg-meta">
                        {[r.geography, r.status].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  ))}
                </div>
              </Section>
            ) : null}

            <LinkedPostsSection posts={profile.linked_posts} />
          </div>

          <aside className="ih-entity-aside-col">
            <div className="ih-aside-block">
              <div className="ih-eyebrow">About this rating</div>
              <p className="ih-aside-note">
                Structural supply risk measures how concentrated this
                material&rsquo;s supply is at its most concentrated stage,
                adjusted for the governance quality of the dominant country.
                It moves when the structure of supply shifts — not with the
                news cycle.
              </p>
              <Link href="/intelligence/methodology" className="ih-aside-link">
                Methodology →
              </Link>
            </div>
            <SubscribeBox className="ih-aside-subscribe" />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
