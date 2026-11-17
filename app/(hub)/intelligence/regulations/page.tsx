"use client";

/**
 * Public regulations browse — /intelligence/regulations.
 * Verified-gated server-side (9 at launch); theme chips derived from the
 * REAL themes present in the response (display-normalized server-side;
 * null theme = pending manual triage, shown as "—" and excluded from chips).
 */

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/hub/Nav";
import { RegulationListRow } from "@/components/hub/entity/RegulationListRow";
import { SkeletonListRows } from "@/components/hub/Skeleton";
import { Footer } from "@/components/hub/Footer";
import { listPublicRegulations, type PublicRegulationListItem } from "@/lib/api/entities";

export default function RegulationsPage() {
  const [regs, setRegs] = useState<PublicRegulationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("All");

  useEffect(() => {
    listPublicRegulations()
      .then((res) => setRegs(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const themes = useMemo(() => {
    const distinct = Array.from(
      new Set(regs.map((r) => r.theme).filter((t): t is string => !!t)),
    ).sort();
    return ["All", ...distinct];
  }, [regs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return regs.filter((r) => {
      const matchQ =
        !needle ||
        (r.title ?? "").toLowerCase().includes(needle) ||
        r.regulation_key.toLowerCase().includes(needle);
      const matchTheme = theme === "All" || r.theme === theme;
      return matchQ && matchTheme;
    });
  }, [regs, q, theme]);

  return (
    <div className="ih-page">
      <Nav section="regulations" />
      <main className="ih-entity-main">
        <header className="ih-browse-head">
          <div className="ih-eyebrow">Browse</div>
          <h1 className="ih-browse-title">Regulations</h1>
          <p className="ih-browse-lede">
            The regulatory and policy instruments shaping critical-mineral supply
            chains — each mapped to the materials and geographies it touches.
          </p>
        </header>

        <div className="ih-browse-controls">
          <input
            className="ih-search"
            type="search"
            placeholder="Search regulations…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="ih-filter-chips">
            {themes.map((t) => (
              <button
                key={t}
                className={"ih-filter-chip" + (t === theme ? " is-active" : "")}
                onClick={() => setTheme(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonListRows rows={6} />
        ) : error ? (
          <div className="ih-browse-meta">Couldn&apos;t load regulations — try again shortly.</div>
        ) : (
          <>
            <div className="ih-browse-meta">
              {filtered.length} of {regs.length} regulations
            </div>
            <div className="ih-list">
              {filtered.map((r) => (
                <RegulationListRow key={r.regulation_key} row={r} />
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
