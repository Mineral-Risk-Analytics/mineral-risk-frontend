"use client";

/**
 * Geographic-footprint row — one country. The whole row (country tag +
 * summary + level + material chips) is clickable when the country has
 * facilities, opening a drawer with those facilities in detail
 * (2026-07-22). Sourcing-only rows (no facilities) aren't clickable.
 */

import { useState } from "react";
import type { GeoFootprintOut } from "@/lib/api/entities";
import { FacilityDrawer } from "./FacilityDrawer";

const LEVEL_LABEL: Record<string, string> = {
  crit: "Crit",
  high: "High",
  med: "Mod",  // 2026-09-24: matches dashboard + methodology vocabulary
  low: "Low",
};

function summary(row: GeoFootprintOut): string {
  const parts: string[] = [];
  if (row.facility_count > 0) {
    parts.push(
      `${row.facility_count} ${row.facility_count === 1 ? "facility" : "facilities"}` +
        (row.activities.length ? ` — ${row.activities.join(", ")}` : ""),
    );
  }
  if (row.sourcing_materials.length > 0) {
    parts.push(`sources ${row.sourcing_materials.join(", ").toLowerCase()}`);
  }
  return parts.join(" · ") || "—";
}

export function GeoRow({ row, slug }: { row: GeoFootprintOut; slug: string }) {
  const level = row.location_risk?.level ?? null;
  const clickable = row.facility_count > 0;
  const [open, setOpen] = useState(false);

  const inner = (
    <>
      <div className="ih-geo-head">
        <span className="ih-tag ih-tag-geo">{row.country}</span>
        <span className="ih-geo-summary">{summary(row)}</span>
        <span
          className={`ih-geo-level ${level ? `ih-mat-level-${level}` : "ih-mat-level-none"}`}
        >
          {level ? LEVEL_LABEL[level] : "—"}
        </span>
        {clickable ? <span className="ih-geo-chevron" aria-hidden>›</span> : null}
      </div>
      {row.materials.length > 0 ? (
        <div className="ih-geo-mats">
          {row.materials.map((m) => (
            <span
              key={m.material}
              className={`ih-geo-mat-chip ih-geo-chip-${m.level}`}
              title={`${m.material} risk at ${row.country} (material × geography)`}
            >
              {m.material} · {LEVEL_LABEL[m.level]}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="ih-geo-row">
      {clickable ? (
        <button
          type="button"
          className="ih-geo-row-inner ih-geo-row-btn"
          onClick={() => setOpen(true)}
          aria-label={`View facilities in ${row.country}`}
        >
          {inner}
        </button>
      ) : (
        <div className="ih-geo-row-inner">{inner}</div>
      )}
      {clickable ? (
        <FacilityDrawer
          slug={slug}
          country={row.country}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}
