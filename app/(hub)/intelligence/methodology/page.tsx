/**
 * Public methodology page — /intelligence/methodology.
 *
 * Copy is A6 (engine docs/design/methodology_page_public_draft.md,
 * approved-scope 2026-08-16: content-site claims only — bands + as-of
 * date; no events-beside-score, no numeric scores, no per-stage display).
 * Built 2026-09-24 with the two open items resolved: headline label =
 * "structural supply risk" (Q4 decision) and the changelog lives on this
 * page. When events/numbers ship publicly (C2/C3), restore the stronger
 * "shown alongside" language — the first draft's phrasing is in the
 * engine doc's git history.
 *
 * Static server component — no data fetching; hub Wine + Stone article
 * typography (ih-article-* classes from hub.css).
 */

import type { Metadata } from "next";
import { Nav } from "@/components/hub/Nav";
import { Breadcrumb } from "@/components/hub/entity/Breadcrumb";
import { Footer } from "@/components/hub/Footer";

export const metadata: Metadata = {
  title: "Methodology — Mineral Risk Analytics",
  description:
    "How our structural supply risk ratings are computed: per-stage supply " +
    "shares, concentration measurement, governance adjustment, and the " +
    "freshness rules behind every rating.",
};

export default function MethodologyPage() {
  return (
    <div className="ih-page">
      <Nav section="intelligence" />
      <main className="ih-entity-main">
        <Breadcrumb
          trail={[
            { label: "Intelligence", href: "/intelligence" },
            { label: "Methodology" },
          ]}
        />

        <article className="ih-article">
          <header className="ih-article-head">
            <h1 className="ih-article-title">How we score supply risk</h1>
            <p className="ih-article-lede">
              What the ratings on this site measure, how they are computed,
              and — just as deliberately — what they do not capture.
            </p>
          </header>

          <div className="ih-article-body">
            <h2 className="ih-article-h2">What the rating measures</h2>
            <p className="ih-article-p">
              The risk ratings on this site measure{" "}
              <strong>structural supply risk</strong>: how concentrated the
              supply of a material is, at its most concentrated processing
              stage, weighted by the governance quality of the country that
              dominates it.
            </p>
            <p className="ih-article-p">
              It answers one question: <em>if you needed this material, how
              exposed are you to a single country&rsquo;s chokehold on
              it?</em>{" "}
              It is deliberately a structural measure — it describes how the
              supply chain is built, not what happened this week. Our
              reporting covers live developments (export bans, quotas,
              sanctions, disruptions) as they happen; the rating moves only
              when the structure of supply actually shifts. A measure that
              mixed slow structure with fast news would answer neither
              question well.
            </p>

            <h2 className="ih-article-h2">How it works</h2>
            <p className="ih-article-p">
              <strong>1. Supply shares by processing stage.</strong> For each
              material we maintain country-level production shares at every
              stage of the chain we can source from citable data — mining,
              intermediate processing, refining, and battery-grade
              conversion. Shares are computed against world totals that{" "}
              <em>include</em> unattributed rest-of-world supply, so a
              country&rsquo;s share is never inflated by an incomplete
              denominator.
            </p>
            <p className="ih-article-p">
              <strong>2. Concentration per stage.</strong> Each stage is
              scored from two things: how concentrated that stage is globally
              (measured with the Herfindahl–Hirschman Index, the standard
              concentration measure used in antitrust review), and how large
              the leading country&rsquo;s share of it is. A stage that is
              both highly concentrated and dominated by one country scores
              near the top of the scale.
            </p>
            <p className="ih-article-p">
              <strong>3. The strongest chokepoint defines the material.</strong>{" "}
              A material&rsquo;s rating is set by its <em>most</em>{" "}
              concentrated stage — not an average across stages. If a
              material is mined in a dozen countries but 90% of its
              battery-grade conversion happens in one, the conversion stage
              sets the rating. Averaging would dilute exactly the risk that
              matters.
            </p>
            <p className="ih-article-p">
              <strong>4. Governance adjustment.</strong> The driving
              stage&rsquo;s result is then adjusted upward when the dominant
              country scores poorly on the World Bank&rsquo;s Worldwide
              Governance Indicators — the same logic the EU Critical Raw
              Materials Act applies: a 75% share held in a fragile
              jurisdiction is riskier than the same share held in a stable
              one. The adjustment is bounded and never manufactures risk
              where concentration is low.
            </p>

            <h2 className="ih-article-h2">Risk bands</h2>
            <p className="ih-article-p">
              The bands you see on this site — <strong>Low</strong>,{" "}
              <strong>Moderate</strong>, <strong>High</strong>,{" "}
              <strong>Critical</strong> — come from fixed cut-offs on an
              underlying 0–100 scale (35 / 60 / 90). Critical is reserved for
              materials where a single country controls roughly 80% or more
              of the binding stage — where no meaningful alternative supply
              exists today. The cut-offs are absolute, not graded on a curve:
              a material&rsquo;s band never changes because a different
              material moved, and bands are revisited only when the
              methodology itself changes.
            </p>
            <p className="ih-article-p">
              Materials without sufficient stage data to rate are excluded
              rather than shown — absence of data is never presented as low
              risk.
            </p>

            <h2 className="ih-article-h2">Data sources</h2>
            <ul className="ih-article-ul">
              <li>
                <strong>Mine-stage production shares</strong> — USGS Mineral
                Commodity Summaries (updated annually).
              </li>
              <li>
                <strong>Midstream &amp; battery-grade shares</strong> — IEA
                Global Critical Minerals Outlook (CC BY 4.0); Cobalt
                Institute Cobalt Market Report (data by Benchmark Mineral
                Intelligence); specialist sources per material (updated
                annually).
              </li>
              <li>
                <strong>Governance indicators</strong> — World Bank Worldwide
                Governance Indicators (updated annually).
              </li>
            </ul>
            <p className="ih-article-p">
              Every share we load is human-verified against its cited source
              before it can affect a rating — machine-extracted numbers never
              contribute unreviewed, and we never estimate a share a source
              doesn&rsquo;t state.
            </p>

            <h2 className="ih-article-h2">Freshness, honestly</h2>
            <p className="ih-article-p">
              Every rating carries an <strong>as-of date</strong>. Behind it,
              every stage input is tracked by source and data year, and share
              data qualifies only while its data year is within 24 months of
              the as-of date — older data is excluded from the rating rather
              than quietly kept. Where the freshness rule excludes a stage we
              know to be concentrated, the published rating errs
              conservative: it can understate risk, never overstate it, and
              we say so rather than estimate a number no source states.
            </p>
            <p className="ih-article-p">
              Because the inputs publish annually, ratings update on an
              annual cycle. That is the appropriate cadence for a structural
              measure; our reporting carries what changed this month.
            </p>

            <h2 className="ih-article-h2">What the rating does not capture</h2>
            <p className="ih-article-p">
              We would rather state the limits than have you discover them:
            </p>
            <ul className="ih-article-ul">
              <li>
                <strong>It does not react to live disruptions.</strong> An
                export ban does not move the rating the day it lands — it
                reaches the structural data when supply shares actually
                shift. Our analysis and reporting cover those developments as
                they happen.
              </li>
              <li>
                <strong>
                  It measures where supply is produced, not where it goes.
                </strong>{" "}
                Exposure that depends on a specific destination (e.g.
                restrictions targeting one importing country) is outside what
                the rating measures.
              </li>
              <li>
                <strong>It only sees stages with citable data.</strong> A
                stage with no published, verifiable share data cannot raise a
                rating — coverage grows as sources allow, and we treat a thin
                ladder as understatement, not as safety.
              </li>
              <li>
                <strong>
                  Additional risk dimensions — trade policy, regulatory
                  exposure, operational disruptions, financial pressure — are
                  measured but not yet published.
                </strong>{" "}
                They enter the headline rating only after validation against
                a human-reviewed baseline meets pre-agreed quality gates. We
                publish the audited number, not the aspirational one.
              </li>
            </ul>

            <h2 className="ih-article-h2">Precedent</h2>
            <p className="ih-article-p">
              The components are deliberately standard: HHI is the
              concentration measure used by the U.S. DOJ/FTC in merger
              review; production-share × governance-quality weighting follows
              the approach of the EU Critical Raw Materials Act and the
              IEA&rsquo;s supply-concentration analyses. Our contribution is
              the per-stage supply-share dataset, the stage-max framing, and
              the freshness discipline — not a novel formula.
            </p>

            <h2 className="ih-article-h2">Versioning</h2>
            <p className="ih-article-p">
              Ratings are recomputed in full from stored evidence — never
              adjusted incrementally — so any published rating can be
              reproduced from its as-of date. Methodology changes are
              versioned and noted on this page; data refreshes are visible as
              new as-of dates with unchanged methodology.
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
