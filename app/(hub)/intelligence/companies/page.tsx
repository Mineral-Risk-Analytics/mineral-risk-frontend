"use client";

/**
 * Public companies browse — /intelligence/companies.
 * Informative-first launch (2026-07-15): no risk-band column.
 * One fetch + client-side filtering (25 published companies at launch);
 * stage chips use the REAL CME vocabulary — the mockup's "Extraction"
 * stage does not exist in the data.
 */

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/hub/Nav";
import { CompanyListRow } from "@/components/hub/entity/CompanyListRow";
import { SkeletonListRows } from "@/components/hub/Skeleton";
import { Footer } from "@/components/hub/Footer";
import { listPublicCompanies, type PublicCompanyListItem } from "@/lib/api/entities";

const STAGE_CHIPS = ["All", "Mining", "Refining", "Cell", "OEM"] as const;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<PublicCompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<(typeof STAGE_CHIPS)[number]>("All");

  useEffect(() => {
    listPublicCompanies()
      .then((res) => setCompanies(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return companies.filter((c) => {
      const matchQ =
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        (c.legal_name ?? "").toLowerCase().includes(needle);
      const matchStage =
        stage === "All" || (c.stage_label ?? "").toLowerCase().includes(stage.toLowerCase());
      return matchQ && matchStage;
    });
  }, [companies, q, stage]);

  return (
    <div className="ih-page">
      <Nav section="companies" />
      <main className="ih-entity-main">
        <header className="ih-browse-head">
          <div className="ih-eyebrow">Browse</div>
          <h1 className="ih-browse-title">Companies</h1>
          <p className="ih-browse-lede">
            Company profiles across the critical-mineral value chain — supply-chain
            positions, material exposure, and facility footprints.
          </p>
        </header>

        <div className="ih-browse-controls">
          <input
            className="ih-search"
            type="search"
            placeholder="Search companies…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="ih-filter-chips">
            {STAGE_CHIPS.map((s) => (
              <button
                key={s}
                className={"ih-filter-chip" + (s === stage ? " is-active" : "")}
                onClick={() => setStage(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonListRows rows={6} />
        ) : error ? (
          <div className="ih-browse-meta">Couldn&apos;t load companies — try again shortly.</div>
        ) : (
          <>
            <div className="ih-browse-meta">
              {filtered.length} of {companies.length} companies
            </div>
            <div className="ih-list">
              {filtered.map((c) => (
                <CompanyListRow key={c.slug} row={c} />
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
