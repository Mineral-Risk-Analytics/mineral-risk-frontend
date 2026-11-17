/**
 * Hub loading skeletons (2026-11-12) — shimmering placeholders that match
 * each surface's real shape, replacing every "Loading…" text state
 * (Nicole: skeletons everywhere, no loading words).
 *
 * Wine + Stone themed (stone-mid base, cream sweep) — do NOT reuse the
 * admin side's shadcn components/ui/skeleton.tsx here; it's Cool
 * Slate-themed and would drift.
 *
 * Primitives compose per page: `Skeleton` is one shimmer block; the
 * exported groups mirror the browse list, feed, article, and entity
 * profile layouts.
 */

import type { CSSProperties } from "react";

export function Skeleton({
  w,
  h = 14,
  style,
  className,
}: {
  /** CSS width — number = px, string passed through ("60%"). */
  w?: number | string;
  h?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`ih-skel${className ? ` ${className}` : ""}`}
      style={{
        width: typeof w === "number" ? `${w}px` : w,
        height: `${h}px`,
        ...style,
      }}
    />
  );
}

/** Browse-list rows (companies / regulations / materials indexes). */
export function SkeletonListRows({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy className="ih-skel-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ih-skel-listrow">
          <div className="ih-skel-listmain">
            <Skeleton w={i % 2 ? 180 : 230} h={18} />
            <div className="ih-skel-facts">
              <Skeleton w={54} h={12} />
              <Skeleton w={i % 2 ? 150 : 110} h={12} />
            </div>
          </div>
          <Skeleton w={14} h={12} />
        </div>
      ))}
    </div>
  );
}

/** Feed rows (intelligence home). */
export function SkeletonFeedRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy className="ih-skel-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ih-skel-feedrow">
          <Skeleton w={76} h={11} />
          <Skeleton w={i % 2 ? "72%" : "58%"} h={16} />
          <Skeleton w="88%" h={12} />
        </div>
      ))}
    </div>
  );
}

/** Article page: headline + lede + body lines. */
export function SkeletonArticle() {
  return (
    <div aria-busy className="ih-skel-article">
      <Skeleton w={110} h={12} />
      <Skeleton w="70%" h={30} style={{ marginTop: 14 }} />
      <Skeleton w="92%" h={14} style={{ marginTop: 16 }} />
      <Skeleton w="85%" h={14} />
      <div style={{ marginTop: 22 }}>
        <Skeleton w="100%" h={13} />
        <Skeleton w="97%" h={13} />
        <Skeleton w="99%" h={13} />
        <Skeleton w="64%" h={13} />
      </div>
    </div>
  );
}

/** Entity profile (company / regulation / material): masthead + sections. */
export function SkeletonProfile() {
  return (
    <div aria-busy className="ih-skel-profile">
      <Skeleton w={64} h={11} />
      <Skeleton w={280} h={30} style={{ marginTop: 12 }} />
      <div className="ih-skel-facts" style={{ marginTop: 12 }}>
        <Skeleton w={110} h={14} />
        <Skeleton w={90} h={14} />
      </div>
      <div className="ih-skel-section">
        <Skeleton w={190} h={18} />
        <SkeletonListRows rows={3} />
      </div>
      <div className="ih-skel-section">
        <Skeleton w={150} h={18} />
        <SkeletonListRows rows={2} />
      </div>
    </div>
  );
}
