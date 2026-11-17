"use client";

/**
 * THE shared hub navbar (2026-07-15: one navbar for all hub pages —
 * feed, companies, regulations; the short-lived separate EntityNav was
 * removed per Nicole).
 *
 * Two layers:
 *   1. Section links — always rendered. Current section gets the
 *      terracotta underline. Driven by the `section` prop.
 *   2. Content-type tabs row — feed-only. Rendered ONLY when the feed
 *      passes `activeTab` + `onTab`; entity pages omit them and get no
 *      tabs row.
 */

import Image from "next/image";
import Link from "next/link";
import { TabLabel } from "./types";

const TABS: TabLabel[] = ["All", "Analysis", "Signal", "Report", "News"];

export type HubSection = "intelligence" | "materials" | "companies" | "regulations";

const SECTION_LINKS: { section: HubSection; label: string; href: string }[] = [
  { section: "intelligence", label: "Intelligence", href: "/intelligence" },
  { section: "materials",    label: "Materials",    href: "/intelligence/materials" },
  { section: "companies",    label: "Companies",    href: "/intelligence/companies" },
  { section: "regulations",  label: "Regulations",  href: "/intelligence/regulations" },
];

interface NavProps {
  /** Which section link gets the current underline. Defaults to the feed. */
  section?: HubSection;
  /** Feed-only content-type tabs. Both must be provided to render the row. */
  activeTab?: TabLabel;
  onTab?: (tab: TabLabel) => void;
}

export function Nav({ section = "intelligence", activeTab, onTab }: NavProps) {
  return (
    <header className="ih-nav-wrap">
      <div className="ih-gradient-bar" />
      <div className="ih-nav">
        <Link href="/intelligence" className="ih-nav-brand">
          <Image
            src="/hub/logo-mra-outline.svg"
            alt="Mineral Risk Analytics"
            width={32}
            height={35}
            className="ih-logo"
          />
          <span className="ih-wm">Mineral Risk Analytics</span>
        </Link>
        <nav className="ih-nav-links">
          {SECTION_LINKS.map((l) => (
            <Link
              key={l.section}
              href={l.href}
              className={"ih-nav-link" + (l.section === section ? " is-current" : "")}
            >
              {l.label}
            </Link>
          ))}
          <button className="ih-btn-primary">Subscribe</button>
        </nav>
      </div>
      {activeTab !== undefined && onTab !== undefined ? (
        <div className="ih-tabs">
          <div className="ih-tabs-inner">
            {TABS.map((t) => (
              <button
                key={t}
                className={"ih-tab" + (t === activeTab ? " is-active" : "")}
                onClick={() => onTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
