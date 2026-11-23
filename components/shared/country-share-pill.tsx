"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { countryCodeToName, countryToFlag } from "@/lib/utils/format";

interface CountrySharePillProps {
  code: string | null | undefined;
  /** Integer percentage, e.g. 47. Omit to render without the share label. */
  sharePct?: number | null;
  /**
   * Display name supplied by the API, preferred over the browser's Intl
   * lookup. The codes in this system come from `countries.iso2`, a column
   * that explicitly admits non-ISO entries (bloc identifiers like "EU", plus
   * whatever territory rows have been added). `Intl.DisplayNames` returns the
   * code unchanged for anything it does not recognise, so without this the
   * tooltip on such a code just repeats the text already on screen. Callers
   * that have no server-side name pass nothing and get the old behaviour.
   */
  name?: string | null;
  /**
   * Appended after the country name, separated by a middot — used where the
   * pill carries a role as well as an identity ("China · Primary geography").
   */
  note?: string;
}

/**
 * Grey pill showing a country flag, ISO-2 code, and optional production-share
 * percentage. Tooltip always shows the full country name on hover.
 *
 * Used as the single pill component wherever a country needs to be displayed
 * in pill form — materials list top sources, material detail overview,
 * dashboard KPI card, the market scores geography column, and the risk-event
 * triage drawer.
 */
export function CountrySharePill({ code, sharePct, name, note }: CountrySharePillProps) {
  if (!code) return null;

  const resolved = name?.trim() || countryCodeToName(code);
  /* Suppress the flag when the name resolved to nothing more than the code
     itself. Regional-indicator pairs render as two letter-boxes for any code
     that is not an assigned region, and a pair of empty boxes beside the same
     letters reads as a rendering fault rather than as "no flag for this". */
  const unresolved = resolved.toUpperCase() === code.toUpperCase();
  const flag = unresolved ? "" : countryToFlag(code);
  const countryName = [resolved, note].filter(Boolean).join(" · ");

  const pill = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 6px",
        background: "var(--p-bg-subtle)",
        border: "1px solid var(--p-border)",
        borderRadius: "var(--p-radius-sm)",
        fontSize: 11,
        whiteSpace: "nowrap",
        lineHeight: 1,
        cursor: "default",
      }}
    >
      {flag && <span aria-hidden>{flag}</span>}
      <span style={{ fontFamily: "var(--p-font-mono)", fontWeight: 500, color: "var(--p-text)" }}>
        {code.toUpperCase()}
      </span>
      {sharePct != null && (
        <>
          <span style={{ color: "var(--p-text-faint)", fontSize: 10 }}>·</span>
          <span style={{ fontWeight: 600, color: "var(--p-text)" }}>{sharePct}%</span>
        </>
      )}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{pill}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{countryName}</TooltipContent>
    </Tooltip>
  );
}
