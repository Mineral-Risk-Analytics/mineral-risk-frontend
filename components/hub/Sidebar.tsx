'use client'

/**
 * Hub sidebar — material risk bars wired to the live API (2026-07-21),
 * replacing the design-phase mock values.
 *
 * Data: GET /intelligence/risk-summary — latest L2 global rollup per
 * material (the SAME numbers as the platform materials page), banded
 * server-side by the shared bands.py cuts (mirrored in
 * lib/utils/risk-band.ts — 35/60/90 + insufficient-data gate as of the
 * 2026-08-11 concentration-launch recalibration).
 *
 * Display (curated full-spectrum, decided 2026-07-21 — replaced the
 * brief top-N hybrid the same day): a fixed list of battery-chain
 * materials a reader will recognize, spanning the whole band range
 * (Crit down to Low) so the panel shows the model discriminates.
 * Deliberate tradeoffs: by-product minor metals (gallium, magnesium,
 * bismuth — currently the top absolute scorers) are NOT shown here;
 * they belong in ranking/report surfaces, not the orientation sidebar.
 * Zinc is included solely to anchor the Low end — no core battery
 * material scores below Mod, which is itself the finding.
 * Order still follows the API (score DESC), so band cut changes or
 * rescores reorder the list automatically; unknown names are skipped.
 *
 * 2026-09-24 (concentration-first launch polish): the mock "Browse by
 * pillar" block is GONE — replaced by "Ratings at a glance", band counts
 * computed from the SAME risk-summary payload as the bars (all rated
 * materials, not just the curated display list). Live, zero extra
 * requests, and no pillar taxonomy on the public sidebar while the
 * published score is concentration-only. Heading renamed to the public
 * label ("Structural supply risk", C1) and the block now links to
 * /intelligence/methodology.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SubscribeBox } from "./SubscribeBox";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

/** Curated sidebar materials (canonical names, API spelling). */
const SIDEBAR_MATERIALS = new Set([
    'Gallium',
    'Natural Graphite',
    'Cobalt',
    'Rare Earth Elements',
    'Nickel',
    'Manganese',
    'Lithium',
    'Copper',
    'Iron Ore',
    'Zinc'
])

/** Long canonical names → sidebar-width display names. */
const DISPLAY_NAME: Record<string, string> = {
    'Natural Graphite': 'Nat. Graphite',
    'Synthetic Graphite': 'Syn. Graphite',
    'Rare Earth Elements': 'Rare Earths',
    'Silicon (Anode Grade)': 'Silicon (Anode)',
    'Platinum-Group Metals': 'PGMs'
}

// "Mod" (not "Med"): matches the dashboard's band vocabulary and the
// methodology page's Low/Moderate/High/Critical (2026-09-24 consistency fix).
const LEVEL_LABEL: Record<string, string> = {
    crit: 'Crit',
    high: 'High',
    med: 'Mod',
    low: 'Low'
}

/** Full band names for the "Ratings at a glance" rows. */
const BAND_NAME: Record<BandLevel, string> = {
    crit: 'Critical',
    high: 'High',
    med: 'Moderate',
    low: 'Low'
}

type BandLevel = 'crit' | 'high' | 'med' | 'low'
const BAND_ORDER: BandLevel[] = ['crit', 'high', 'med', 'low']

/** API shape — mirrors MaterialRiskBar / RiskSummary (app/schemas/intelligence.py). */
interface ApiRiskBar {
    material_id: number
    material_name: string
    band: {
        label: string
        level: 'crit' | 'high' | 'med' | 'low'
        score: number | null
    }
}

interface ApiRiskSummary {
    as_of_date: string | null
    materials: ApiRiskBar[]
}

function formatAsOf(iso: string): string {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    })
}

function MatRow({ bar }: { bar: ApiRiskBar }) {
    const score = bar.band.score ?? 0
    return (
        <div className='ih-mat-row'>
            <span className='ih-mat-name' title={bar.material_name}>
                {DISPLAY_NAME[bar.material_name] ?? bar.material_name}
            </span>
            <div className='ih-mat-track'>
                <div
                    className={`ih-mat-fill ih-mat-${bar.band.level}`}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
            </div>
            <span className={`ih-mat-level ih-mat-level-${bar.band.level}`}>
                {LEVEL_LABEL[bar.band.level] ?? bar.band.label}
            </span>
        </div>
    )
}

export function Sidebar() {
    const [summary, setSummary] = useState<ApiRiskSummary | null>(null)

    useEffect(() => {
        let cancelled = false
        fetch(`${API_BASE}/api/v1/intelligence/risk-summary`)
            .then((r) => {
                if (!r.ok) throw new Error(String(r.status))
                return r.json()
            })
            .then((json: ApiRiskSummary) => {
                if (!cancelled) setSummary(json)
            })
            .catch(() => {
                /* On error the whole block stays hidden — never show stale or
           invented numbers on the public site. */
            })
        return () => {
            cancelled = true
        }
    }, [])

    const bars = (summary?.materials ?? []).filter((b) => SIDEBAR_MATERIALS.has(b.material_name))

    // Band distribution across ALL rated materials in the payload (not the
    // curated bar list) — a live "Ratings at a glance". Materials the
    // insufficient-data gate excludes carry no countable level and are
    // skipped, consistent with "absence of data is never low risk".
    const bandCounts: Record<BandLevel, number> = { crit: 0, high: 0, med: 0, low: 0 }
    let ratedTotal = 0
    for (const m of summary?.materials ?? []) {
        const level = m.band.level as BandLevel
        if (level in bandCounts && m.band.score !== null) {
            bandCounts[level] += 1
            ratedTotal += 1
        }
    }

    return (
        <aside className='ih-sidebar'>
            {/* Material risk bars — hidden until live data arrives */}
            {bars.length > 0 ? (
                <section className='ih-side-block'>
                    <div className='ih-eyebrow'>Structural supply risk</div>

                    <div className='ih-mat-list'>
                        {bars.map((b) => (
                            <MatRow key={b.material_id} bar={b} />
                        ))}
                    </div>

                    {summary?.as_of_date ? (
                        <div className='ih-mat-asof'>Scores as of {formatAsOf(summary.as_of_date)}</div>
                    ) : null}
                    <Link href='/intelligence/methodology' className='ih-mat-asof'>
                        How these ratings work →
                    </Link>
                </section>
            ) : null}

            {/* Ratings at a glance — band distribution, same live payload */}
            {ratedTotal > 0 ? (
                <section className='ih-side-block'>
                    <div className='ih-eyebrow'>Ratings at a glance</div>
                    <div className='ih-pillars'>
                        {BAND_ORDER.map((level) => (
                            <div key={level} className='ih-pillar-btn'>
                                <span className='ih-pillar-l'>
                                    <span className={`ih-pillar-dot ih-mat-fill ih-mat-${level}`} />
                                    {BAND_NAME[level]}
                                </span>
                                <span className={`ih-pillar-n ih-mat-level-${level}`}>
                                    {bandCounts[level]}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className='ih-mat-asof'>{ratedTotal} rated materials</div>
                </section>
            ) : null}

            {/* Subscribe */}
            <SubscribeBox className='ih-side-block' />
        </aside>
    )
}
