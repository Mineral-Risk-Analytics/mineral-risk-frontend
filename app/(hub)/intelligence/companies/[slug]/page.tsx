'use client'

/**
 * Public company profile — /intelligence/companies/[slug].
 *
 * Header comment refreshed 2026-09-24 — the 2026-07-15 "informative-first"
 * note had drifted from reality. What the page ACTUALLY shows today:
 * identity, supply chain, material-level global + per-location scores
 * (added 2026-07-21/22), facility drawer, linked posts (restored
 * 2026-07-22), subscribe, and a methodology link (wired 2026-09-24).
 * Still hidden: the company-level band (`company.band` is fetched but not
 * rendered) and linked events (Phase-5 flag).
 * The lede renders companies.public_intro and is omitted when unset.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Nav } from '@/components/hub/Nav'
import { Breadcrumb } from '@/components/hub/entity/Breadcrumb'
import { EntityHeader } from '@/components/hub/entity/EntityHeader'
import { Section } from '@/components/hub/entity/Section'
import { ExposureRow } from '@/components/hub/entity/ExposureRow'
import { GeoRow } from '@/components/hub/entity/GeoRow'
import { LinkedPostsSection } from '@/components/hub/entity/LinkedPosts'
import { SubscribeBox } from '@/components/hub/SubscribeBox'
import { IntroBlocks } from '@/components/hub/entity/IntroBlocks'
import { Footer } from '@/components/hub/Footer'
import { getPublicCompany, type PublicCompanyProfile } from '@/lib/api/entities'

export default function CompanyProfilePage() {
    const params = useParams<{ slug: string }>()
    const [company, setCompany] = useState<PublicCompanyProfile | null>(null)
    const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')

    useEffect(() => {
        if (!params?.slug) return
        getPublicCompany(params.slug)
            .then((c) => {
                setCompany(c)
                setState('ready')
            })
            .catch((e: Error) => setState(e.message === '404' ? 'missing' : 'error'))
    }, [params?.slug])

    if (state !== 'ready' || !company) {
        return (
            <div className='ih-page'>
                <Nav section='companies' />
                <main className='ih-entity-main'>
                    <div className='ih-browse-meta'>
                        {state === 'loading'
                            ? 'Loading…'
                            : state === 'missing'
                              ? 'Company not found.'
                              : "Couldn't load this company — try again shortly."}
                    </div>
                </main>
                <Footer />
            </div>
        )
    }

    return (
        <div className='ih-page'>
            <Nav section='companies' />
            <main className='ih-entity-main'>
                <Breadcrumb
                    trail={[
                        { label: 'Intelligence', href: '/intelligence' },
                        { label: 'Companies', href: '/intelligence/companies' },
                        { label: company.name }
                    ]}
                />

                <EntityHeader
                    eyebrow='Company'
                    title={company.name}
                    subtitle={company.legal_name}
                    facts={company.facts}
                />

                <IntroBlocks text={company.intro} />

                <div className='ih-entity-grid'>
                    <div className='ih-entity-col'>
                        <Section
                            title='Material exposure — global risk'
                            aside={company.exposures.length ? `${company.exposures.length} materials` : null}
                            note="One row per material this company depends on; each bar is the material's global supply-chain risk score (0–100). Where this company's own risk sits is in the Geographic footprint below."
                        >
                            {company.exposures.length ? (
                                <div className='ih-expo-list'>
                                    {company.exposures.map((e, i) => (
                                        <ExposureRow key={i} row={e} />
                                    ))}
                                </div>
                            ) : (
                                <p className='ih-empty-note'>No tracked material exposures yet.</p>
                            )}
                        </Section>

                        <Section
                            title='Geographic footprint — risk at location'
                            aside={
                                company.geographies.length
                                    ? `${company.geographies.length} ${company.geographies.length === 1 ? 'country' : 'countries'} · ${company.facilities_total} ${company.facilities_total === 1 ? 'facility' : 'facilities'}`
                                    : null
                            }
                            note='One row per country this company operates or sources in, riskiest first. Chips score each material at that location (material × geography) — a property of the place, so they can differ from the global scores above.'
                        >
                            {company.geographies.length ? (
                                <div className='ih-geo-list'>
                                    {company.geographies.map((g) => (
                                        <GeoRow key={g.country} row={g} slug={company.slug} />
                                    ))}
                                </div>
                            ) : (
                                <p className='ih-empty-note'>No tracked footprint yet.</p>
                            )}
                        </Section>
                    </div>

                    <aside className='ih-entity-aside-col'>
                        <div className='ih-aside-block'>
                            <div className='ih-eyebrow'>On this company</div>
                            <p className='ih-aside-note'>
                                Coverage is company-agnostic and regulatory-led. Scores reflect supply-chain exposure,
                                not investment guidance.
                            </p>
                            <Link href='/intelligence/methodology' className='ih-aside-link'>
                                Methodology →
                            </Link>
                        </div>

                        <SubscribeBox className='ih-aside-subscribe' />
                    </aside>
                </div>

                <LinkedPostsSection posts={company.linked_posts} />
            </main>
            <Footer />
        </div>
    )
}
