"use client";

/**
 * Public materials index — /intelligence/materials.
 *
 * 2026-11-12 redesign (Mockup A): companies-page browse rows replace the
 * full-width score bars. The score is supply-concentration only for now,
 * so it must not be the page's main point (Nicole): risk reads as a small
 * word-chip in each row's facts line — the ih-geo-chip family, "name ·
 * band, no number" — next to the driving stage. Search + band filter
 * chips mirror the companies browse page. Rating order is kept (the API
 * sorts score-desc) but no score is shown.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/hub/Nav";
import { Footer } from "@/components/hub/Footer";
import { Breadcrumb } from "@/components/hub/entity/Breadcrumb";
import { SkeletonListRows } from "@/components/hub/Skeleton";
import {
  listPublicMaterials,
  type PublicMaterialListItem,
} from "@/lib/api/entities";

const BAND_CHIPS = ["All", "Critical", "High", "Moderate", "Low"] as const;

const LEVEL_WORD: Record<string, (typeof BAND_CHIPS)[number]> = {
  crit: "Critical",
  high: "High",
  med: "Moderate",
  low: "Low",
};

/** Lowercase stage phrasing for the facts line. */
const STAGE_PHRASE: Record<string, string> = {
  ore: "mining",
  concentrate: "concentrate production",
  intermediate: "intermediate processing",
  refined: "refining",
  battery_grade: "battery-grade conversion",
};

function MaterialRow({ m }: { m: PublicMaterialListItem }) {
  const word = LEVEL_WORD[m.band.level] ?? m.band.label;
  const stage = m.driving_stage
    ? STAGE_PHRASE[m.driving_stage] ?? m.driving_stage
    : null;
  return (
    <Link href={`/intelligence/materials/${m.slug}`} className="ih-list-row">
      <div className="ih-list-main">
        <h3 className="ih-list-title">{m.name}</h3>
        <div className="ih-list-facts">
          <span
            className={`ih-geo-mat-chip ih-geo-chip-${m.band.level} ih-matlist-chip`}
            title="Structural supply risk band"
          >
            {word}
          </span>
          {stage ? (
            <>
              <span className="ih-list-dot">·</span>
              <span className="ih-list-fact">
                Most concentrated at {stage}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="ih-list-aside">
        <span className="ih-list-arrow">→</span>
      </div>
    </Link>
  );
}

export default function MaterialsPage() {
  const [items, setItems] = useState<PublicMaterialListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [band, setBand] = useState<(typeof BAND_CHIPS)[number]>("All");

  useEffect(() => {
    let live = true;
    listPublicMaterials()
      .then((res) => {
        if (live) setItems(res);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((m) => {
      const matchQ = !needle || m.name.toLowerCase().includes(needle);
      const matchBand =
        band === "All" || (LEVEL_WORD[m.band.level] ?? m.band.label) === band;
      return matchQ && matchBand;
    });
  }, [items, q, band]);

  return (
    <div className="ih-page">
      <Nav section="materials" />
      <main className="ih-entity-main">
        <Breadcrumb
          trail={[
            { label: "Intelligence", href: "/intelligence" },
            { label: "Materials" },
          ]}
        />
        <header className="ih-browse-head">
          <div className="ih-eyebrow">Browse</div>
          <h1 className="ih-browse-title">Materials</h1>
          <p className="ih-browse-lede">
            Material profiles across the battery and critical-mineral supply
            chain — where supply is concentrated, the rules that govern it,
            and the signals we track.{" "}
            <Link href="/intelligence/methodology" className="ih-aside-link">
              How ratings work →
            </Link>
          </p>
        </header>

        <div className="ih-browse-controls">
          <input
            className="ih-search"
            type="search"
            placeholder="Search materials…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="ih-filter-chips">
            {BAND_CHIPS.map((b) => (
              <button
                key={b}
                className={"ih-filter-chip" + (b === band ? " is-active" : "")}
                onClick={() => setBand(b)}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {items === null && !error ? (
          <SkeletonListRows rows={8} />
        ) : error ? (
          <div className="ih-browse-meta">
            Ratings are temporarily unavailable — please check back shortly.
          </div>
        ) : (
          <>
            <div className="ih-browse-meta">
              {filtered.length} of {(items ?? []).length} rated materials
            </div>
            <div className="ih-list">
              {filtered.map((m) => (
                <MaterialRow key={m.slug} m={m} />
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
