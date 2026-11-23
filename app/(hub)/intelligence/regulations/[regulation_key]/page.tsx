"use client";

/**
 * Public regulation detail — /intelligence/regulations/[regulation_key].
 * Informative-first launch (2026-07-15): facts, summary, 3-stage timeline
 * (Proposed → Enacted → Effective), scope chips, source when present.
 * Hidden until later phases: scoring-impact panel (both the mock's fake
 * numbers AND the real compliance weights), linked posts.
 * Verified-gated server-side — unverified keys 404.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Nav } from "@/components/hub/Nav";
import { Breadcrumb } from "@/components/hub/entity/Breadcrumb";
import { EntityHeader } from "@/components/hub/entity/EntityHeader";
import { Section } from "@/components/hub/entity/Section";
import { LinkedEventsSection, LinkedPostsSection } from "@/components/hub/entity/LinkedPosts";
import { ScopeChips } from "@/components/hub/entity/ScopeChips";
import { TimelineStrip } from "@/components/hub/entity/TimelineStrip";
import { IntroBlocks } from "@/components/hub/entity/IntroBlocks";
import { Footer } from "@/components/hub/Footer";
import { SkeletonProfile } from "@/components/hub/Skeleton";
import { getPublicRegulation, type PublicRegulationDetail } from "@/lib/api/entities";
import { SubscribeBox } from "@/components/hub/SubscribeBox";

// Workbook editorial sections, rendered in this order (2026-07-26).
const EDITORIAL_SECTIONS: [key: string, title: string][] = [
  ["what_it_requires", "What it requires"],
  ["who_must_comply", "Who must comply"],
  ["materials_and_origins", "Materials & origins"],
  ["key_dates", "Key dates"],
  ["why_it_matters", "Why it matters"],
];

export default function RegulationDetailPage() {
  const params = useParams<{ regulation_key: string }>();
  const [reg, setReg] = useState<PublicRegulationDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    if (!params?.regulation_key) return;
    getPublicRegulation(decodeURIComponent(params.regulation_key))
      .then((r) => {
        setReg(r);
        setState("ready");
      })
      .catch((e: Error) => setState(e.message === "404" ? "missing" : "error"));
  }, [params?.regulation_key]);

  if (state !== "ready" || !reg) {
    return (
      <div className="ih-page">
        <Nav section="regulations" />
        <main className="ih-entity-main">
          {state === "loading" ? (
            <SkeletonProfile />
          ) : (
            <div className="ih-browse-meta">
              {state === "missing"
                ? "Regulation not found."
                : "Couldn't load this regulation — try again shortly."}
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  // 2026-07-26 (Nicole): internal regulation_key removed from the public
  // fact row — it's a slug, not information a reader needs.
  const facts = [
    ...(reg.geography ? [{ label: "Geography", value: reg.geography, mono: false }] : []),
    ...(reg.theme ? [{ label: "Theme", value: reg.theme, mono: false }] : []),
    ...(reg.status ? [{ label: "Status", value: reg.status, mono: false }] : []),
  ];

  return (
    <div className="ih-page">
      <Nav section="regulations" />
      <main className="ih-entity-main">
        <Breadcrumb
          trail={[
            { label: "Intelligence", href: "/intelligence" },
            { label: "Regulations", href: "/intelligence/regulations" },
            { label: reg.regulation_key },
          ]}
        />

        <EntityHeader
          eyebrow="Regulation"
          title={reg.title ?? reg.regulation_key}
          subtitle={reg.issuer}
          facts={facts}
        />

        <IntroBlocks text={reg.editorial?.standfirst ?? reg.summary} />

        <div className="ih-entity-grid">
          <div className="ih-entity-col">
          <Section title="Status & key dates">
            <TimelineStrip nodes={reg.timeline} />
          </Section>

          {EDITORIAL_SECTIONS.map(([key, title]) => {
            const text = reg.editorial?.sections?.[key];
            if (!text) return null;
            return (
              <Section key={key} title={title}>
                <p className="ih-entity-body">{text}</p>
              </Section>
            );
          })}

          {reg.materials_scope.length || reg.geographies_scope.length ? (
            <Section title="Scope">
              <div className="ih-scope">
                <ScopeChips
                  label="Materials in scope"
                  items={reg.materials_scope.map((m) => m.material)}
                  kind="mat"
                />
                <ScopeChips
                  label="Geographies in scope"
                  items={reg.geographies_scope.map((g) => g.country_code)}
                  kind="geo"
                />
              </div>
            </Section>
          ) : null}

          {reg.editorial?.further_reading?.length ? (
            <Section title="Further reading">
              <ul className="ih-further-reading">
                {reg.editorial.further_reading.map((fr, i) => (
                  <li key={i} className="ih-further-reading-item">
                    <a
                      className="ih-further-reading-link"
                      href={fr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {fr.title}
                    </a>
                    {fr.publisher ? (
                      <span className="ih-further-reading-pub">
                        {" "}— {fr.publisher}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : reg.source_url ? (
            <Section title="Source">
              <a
                className="ih-cta ih-cta-inline"
                href={reg.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View source →
              </a>
            </Section>
          ) : null}
          </div>

          <aside className="ih-entity-aside-col">
            <div className="ih-aside-block">
              <div className="ih-eyebrow">On this regulation</div>
              <p className="ih-aside-note">
                Status, scope, and analysis are curated from primary sources —
                see Further reading for the underlying texts.
              </p>
            </div>

            <SubscribeBox className="ih-aside-subscribe" />
          </aside>
        </div>

        <LinkedPostsSection posts={reg.linked_posts} />
                <LinkedEventsSection events={reg.linked_events} />
      </main>
      <Footer />
    </div>
  );
}
