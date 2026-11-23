/**
 * Material-exposure row — "market + map" v4 (2026-07-21): one deduped
 * row per material; bar = the material's GLOBAL risk score, identical to
 * the sidebar everywhere. Mockup structure (EntityBlocks.jsx
 * MaterialExposure): name + stage tags | risk track | short level label.
 * The where-question lives in GeoRow — this section never shows
 * per-geography numbers, which is what killed the v1-v3 designs.
 * Unscored (gated) rows render an empty track and a muted dash.
 */

import type { ExposureOut } from "@/lib/api/entities";

const LEVEL_LABEL: Record<string, string> = {
  crit: "Crit",
  high: "High",
  med: "Mod",  // 2026-09-24: matches dashboard + methodology vocabulary
  low: "Low",
};

export function ExposureRow({ row }: { row: ExposureOut }) {
  const level = row.band?.level ?? null;
  const score = row.risk_score;
  const scored = level !== null && score != null;

  return (
    <div
      className="ih-expo-row"
      title={
        scored
          ? `${row.material} — global material risk score`
          : "No risk score available for this material yet"
      }
    >
      <div className="ih-expo-main">
        <span className="ih-expo-name">{row.material}</span>
        {row.stage_label ? <span className="ih-tag ih-tag-mat">{row.stage_label}</span> : null}
      </div>
      <div className="ih-expo-track">
        {scored ? (
          <div
            className={`ih-expo-fill ih-mat-${level}`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        ) : null}
      </div>
      <span
        className={`ih-expo-level ${scored ? `ih-mat-level-${level}` : "ih-mat-level-none"}`}
      >
        {scored ? (LEVEL_LABEL[level] ?? row.band!.label) : "—"}
      </span>
    </div>
  );
}
