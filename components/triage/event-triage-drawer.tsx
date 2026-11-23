"use client";

/**
 * Event triage drawer — the full decision surface for one event.
 *
 * Triage v1 edits category, links and status only. Event type, relevance
 * weights and severity are shown but locked, and say so rather than looking
 * inert for no reason.
 *
 * Operational promotion has no separate verification gate: promoting sets
 * triage_status='scoring' AND verified=True in the same write, so approving
 * IS verifying. Positive-direction events are refused for promotion — they
 * are excluded from risk arithmetic at read time, so an approved positive
 * would look promoted and contribute nothing (the page computes
 * `disallowScoring` from the event subtype and passes it down).
 */

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Flag,
  Lock,
  Plus,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SideSheet, SideSheetContent } from "@/components/ui/side-sheet";
import { CountrySharePill } from "@/components/shared/country-share-pill";
import { EventStatusBadge } from "@/components/triage/event-status-badge";
import { TriageStatusControl } from "@/components/triage/triage-status-control";
import { SuggestedLinkRow } from "@/components/triage/suggested-link-row";
import { QualityDefectChips } from "@/components/triage/quality-defect-chips";
import { MaterialPicker } from "@/components/triage/material-picker";
import { ConfidenceChip, SeverityChip } from "@/components/triage/score-chips";
import {
  PRIMARY_CATEGORY_PRECEDENCE,
  PillarChip,
  pillarMeta,
} from "@/components/triage/category-cell";
import {
  addMaterialLink,
  flagEvent,
  getDuplicateHints,
  type DuplicateHints,
  type LinkKind,
  type LinkStatus,
  type TriageEvent,
  type TriageStatus,
} from "@/lib/api/triage";
import { useTriageApi } from "@/lib/hooks/use-triage";
import { formatDate, humanize } from "@/lib/utils/format";

const sectionLabel: CSSProperties = {
  margin: 0,
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--p-text-muted)",
};

const microLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--p-text-faint)",
};

/* SeverityChip / ConfidenceChip now come from components/triage/score-chips.
   Local copies lived here with a 3-band ramp at 0.7 / 0.5 that matched neither
   the design system nor the page's own copy of the same widget. */

function Banner({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        borderRadius: "var(--p-radius-md)",
        border: "1px solid var(--p-border)",
        background: "var(--p-bg-subtle)",
        padding: "10px 12px",
        fontSize: "var(--p-text-xs, 12px)",
        lineHeight: 1.5,
        color: "var(--p-text-muted)",
      }}
    >
      {children}
    </div>
  );
}

function LockedField({
  label,
  value,
  why,
}: {
  label: string;
  value: ReactNode;
  why: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 0",
        borderTop: "1px solid var(--p-rule)",
        fontSize: "var(--p-text-xs, 12px)",
      }}
    >
      <span style={{ flexShrink: 0, width: 116, color: "var(--p-text-muted)" }}>
        {label}
      </span>
      <div
        style={{
          minWidth: 0,
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--p-text)",
        }}
      >
        {value}
        <span
          title={why}
          style={{
            display: "inline-flex",
            color: "var(--p-text-faint)",
            cursor: "help",
          }}
        >
          <Lock size={11} strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}

function ProvenanceRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "8px 0",
        borderTop: "1px solid var(--p-rule)",
        fontSize: "var(--p-text-xs, 12px)",
      }}
    >
      <span style={{ flexShrink: 0, width: 116, color: "var(--p-text-muted)" }}>
        {label}
      </span>
      <div style={{ minWidth: 0, flex: 1, color: "var(--p-text)" }}>{value}</div>
    </div>
  );
}

/** Assigns the ONE pillar an event scores in (`primary_category`).
 *
 *  Options are ordered by the engine's own precedence, not by the display
 *  order used elsewhere, so the pillar the machine would have chosen by
 *  default sits first.
 *
 *  The trailing "Display only" option is the null case. There is no such thing
 *  as an event that scores in no pillar: dropping the pillar IS the
 *  display-only decision, so that option moves triage_status rather than
 *  clearing primary_category — the backend has no way to record the latter.
 */
function PillarSelect({
  value,
  onChange,
  onNone,
  disabled,
}: {
  value: string | null;
  onChange: (next: string) => void;
  onNone: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Primary scoring pillar"
      style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
    >
      {PRIMARY_CATEGORY_PRECEDENCE.map((p) => {
        const d = pillarMeta(p);
        const on = value === p;
        const color = d.cssVar ? "var(" + d.cssVar + ")" : "var(--p-text-muted)";
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(p)}
            title={d.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 26,
              padding: "0 9px",
              borderRadius: "var(--p-radius-md)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: on ? color : "var(--p-border)",
              background: on
                ? "color-mix(in oklab, " + color + " 12%, white)"
                : "var(--p-card)",
              color: on ? color : "var(--p-text-muted)",
              fontFamily: "var(--p-font-sans)",
              fontSize: "var(--p-text-2xs, 11px)",
              fontWeight: on ? 600 : 500,
              whiteSpace: "nowrap",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
              transition:
                "background var(--p-dur, 120ms) var(--p-ease, ease), border-color var(--p-dur, 120ms) var(--p-ease, ease), color var(--p-dur, 120ms) var(--p-ease, ease)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "var(--p-radius-pill, 999px)",
                background: on ? color : "var(--p-border-strong)",
                flexShrink: 0,
              }}
            />
            {d.short}
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={value == null}
        disabled={disabled}
        onClick={onNone}
        title="Display only — stays in the feed, but no pillar scores from it"
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 26,
          padding: "0 9px",
          borderRadius: "var(--p-radius-md)",
          borderWidth: 1,
          borderStyle: value == null ? "solid" : "dashed",
          borderColor: value == null ? "var(--p-text-muted)" : "var(--p-border)",
          background: value == null ? "var(--p-bg-muted)" : "var(--p-card)",
          color: value == null ? "var(--p-text)" : "var(--p-text-faint)",
          fontFamily: "var(--p-font-sans)",
          fontSize: "var(--p-text-2xs, 11px)",
          fontWeight: value == null ? 600 : 500,
          whiteSpace: "nowrap",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition:
            "background var(--p-dur, 120ms) var(--p-ease, ease), border-color var(--p-dur, 120ms) var(--p-ease, ease), color var(--p-dur, 120ms) var(--p-ease, ease)",
        }}
      >
        None
      </button>
    </div>
  );
}

/** Links grouped by the entity kind they point at, as in the wireframe.
 *  Renders nothing when the group is empty — an "Companies (0)" heading on
 *  every event would be noise. */
function LinkGroup({
  title,
  links,
  pending,
  onSetStatus,
}: {
  title: string;
  links: TriageEvent["links"];
  pending?: boolean;
  onSetStatus: (linkId: number, next: LinkStatus) => void;
}) {
  if (!links.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={microLabel}>{title}</span>
      {links.map((l) => (
        <SuggestedLinkRow
          key={l.id}
          link={l}
          pending={pending}
          onSetStatus={onSetStatus}
        />
      ))}
    </div>
  );
}

const LINK_GROUPS: Array<{ kind: LinkKind; title: string }> = [
  { kind: "material", title: "Materials" },
  { kind: "company", title: "Companies" },
  { kind: "facility", title: "Facilities" },
  { kind: "regulation", title: "Regulations" },
];

function hintTitle(hint: Record<string, unknown>): string {
  for (const key of ["title", "canonical_title", "event_title"]) {
    const v = hint[key];
    if (typeof v === "string" && v) return v;
  }
  const id = hint["id"] ?? hint["event_id"] ?? hint["canonical_id"];
  return id != null ? "Event #" + String(id) : "Untitled candidate";
}

export interface EventTriageDrawerProps {
  open: boolean;
  event: TriageEvent | null;
  pending?: boolean;
  /** Read off the event's `is_positive`, which the API serves. Positive-
   *  direction events are excluded from risk arithmetic, so approving one
   *  would look like a promotion and contribute nothing. */
  disallowScoring: boolean;
  onClose: () => void;
  onStatus: (id: number, next: TriageStatus) => void;
  onCategory: (id: number, primaryCategory: string) => void;
  onLinkStatus: (linkId: number, next: LinkStatus) => void;
  onAccept: (id: number) => void;
  /** Called after a data-quality flag is filed, so the page can refetch. */
  onFlagged?: () => void;
}

export function EventTriageDrawer({
  open,
  event,
  pending,
  disallowScoring,
  onClose,
  onStatus,
  onCategory,
  onLinkStatus,
  onAccept,
  onFlagged,
}: EventTriageDrawerProps) {
  const api = useTriageApi();

  const [hints, setHints] = useState<DuplicateHints | null>(null);
  const [hintsLoading, setHintsLoading] = useState(false);

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagText, setFlagText] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const eventId = event?.id ?? null;

  /* Every material already on the event, regardless of link status — a
     rejected link still occupies the (event, material) pair, so re-attaching
     it would either 409 or silently no-op. Reversing the rejection is the
     correct move there, and the link row is still on screen to do it with. */
  const linkedMaterialIds = useMemo(
    () =>
      (event?.links ?? [])
        .filter((l) => l.kind === "material")
        .map((l) => l.material_id),
    [event?.links],
  );

  useEffect(() => {
    setHints(null);
    setFlagOpen(false);
    setFlagText("");
    setFlagError(null);
    setAdding(false);
    setAttachError(null);
    if (!open || eventId == null) return;
    let cancelled = false;
    setHintsLoading(true);
    getDuplicateHints(api, eventId)
      .then((d) => {
        if (!cancelled) setHints(d);
      })
      .catch(() => {
        if (!cancelled) setHints(null);
      })
      .finally(() => {
        if (!cancelled) setHintsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventId, api]);

  if (!event) {
    return <SideSheet open={false} onOpenChange={() => onClose()} />;
  }

  const typeLabel = event.event_subtype
    ? humanize(event.event_type) + " · " + humanize(event.event_subtype)
    : humanize(event.event_type);

  const suggestedLinks = event.links.filter((l) => l.status === "suggested");
  const confirmedLinks = event.links.filter((l) => l.status === "confirmed");
  const untouched =
    event.triage_status === "pending_triage" &&
    suggestedLinks.length === event.links.length;
  const positive = disallowScoring;
  /* "Accept all" promotes the event to scoring exactly as the machine proposed
     it, so it is only offered where that transition is legal. `_apply_status`
     refuses two cases outright with a 400: a positive-direction event, which is
     excluded from risk arithmetic and so would be marked promoted while
     contributing nothing, and an operational news candidate, which needs a
     subtype and severity that only the promote dialog collects. Gating on
     `untouched` alone put the button on both. */
  const acceptable =
    untouched &&
    !positive &&
    event.event_type !== "operational_news_candidate";

  const submitFlag = async () => {
    if (!flagText.trim()) return;
    setFlagSubmitting(true);
    setFlagError(null);
    try {
      await flagEvent(api, event.id, { note_text: flagText.trim() });
      setFlagOpen(false);
      setFlagText("");
      onFlagged?.();
    } catch (err: unknown) {
      setFlagError(err instanceof Error ? err.message : "Could not file the flag");
    } finally {
      setFlagSubmitting(false);
    }
  };

  const attachMaterial = async (materialId: number) => {
    setAttaching(true);
    setAttachError(null);
    try {
      await addMaterialLink(api, event.id, materialId);
      setAdding(false);
      // A hand-attached link is created already confirmed (status 'confirmed',
      // match_reason 'triage_attach') — an analyst picking a material *is* the
      // confirmation, so it lands in the confirmed group, not the suggested
      // one. Refetching is what puts it on screen, so reuse the same refresh
      // hook the flag dialog uses.
      onFlagged?.();
    } catch (err: unknown) {
      setAttachError(
        err instanceof Error ? err.message : "Could not attach that material",
      );
    } finally {
      setAttaching(false);
    }
  };

  return (
    <SideSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SideSheetContent aria-describedby={undefined}>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
          {/* ── Header ── */}
          <div style={{ padding: "24px 24px 16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--p-font-mono)",
                  fontSize: "var(--p-text-2xs, 11px)",
                  color: "var(--p-text-muted)",
                }}
              >
                #{event.id}
              </span>
              <EventStatusBadge status={event.triage_status} />
              {event.verified && (
                <span
                  title="Approving an event marks it verified in the same write — operational scoring reads this flag"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "var(--p-text-2xs, 11px)",
                    fontWeight: 600,
                    color: "#065F46",
                    cursor: "help",
                  }}
                >
                  <CheckCircle2 size={12} strokeWidth={2.25} /> Verified
                </span>
              )}
              <QualityDefectChips defects={event.quality_defects} />
            </div>
            <DialogTitle
              style={{
                margin: 0,
                paddingRight: 32,
                fontSize: 18,
                fontWeight: 600,
                lineHeight: "var(--p-lh-snug, 1.35)",
                color: "var(--p-text)",
              }}
            >
              {event.title}
            </DialogTitle>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: "var(--p-text-xs, 12px)",
                color: "var(--p-text-muted)",
              }}
            >
              <span>{event.source_system || "(uncredited source)"}</span>
              <span>·</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {event.event_date ? formatDate(event.event_date) : "no date"}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <SeverityChip score={event.severity_score} />
                <ConfidenceChip score={event.confidence_score} />
              </span>
            </div>
          </div>

          {/* ── Summary ── */}
          {event.summary && (
            <div style={{ padding: "0 24px 16px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--p-text-md, 14px)",
                  lineHeight: 1.6,
                  color: "var(--p-text)",
                  textWrap: "pretty",
                }}
              >
                {event.summary}
                {event.quality_defects.includes("truncated_summary") && (
                  <span
                    title="Sliced at 500 characters on ingest. The full text is not recoverable from the database — the source item must be re-ingested."
                    style={{
                      marginLeft: 4,
                      color: "var(--p-risk-mod)",
                      fontWeight: 600,
                      cursor: "help",
                    }}
                  >
                    […truncated]
                  </span>
                )}
              </p>
            </div>
          )}

          {untouched && (
            <div style={{ padding: "0 24px 16px" }}>
              <Banner>
                {/* The wholesale half of this sentence only holds where the
                    Accept-all button is actually offered; on a positive event
                    or a news candidate it would point at a control that is not
                    there. */}
                Everything below is a machine suggestion.{" "}
                {acceptable
                  ? "Accept it wholesale, or correct the pillar and links first — nothing here scores until you do."
                  : "Correct the pillar and links, then make the call below — nothing here scores until you do."}
              </Banner>
            </div>
          )}

          {positive && (
            <div style={{ padding: "0 24px 16px" }}>
              <Banner>
                Positive-direction event ({humanize(event.event_subtype)}).
                Positives are excluded from risk arithmetic at read time, so
                approving this for scoring would mark it promoted while
                contributing nothing. Keep it display-only — it stays visible
                in the feed and the evidence drawer. If the story really is a
                supply disruption, it needs the disruption subtype that
                describes it.
              </Banner>
            </div>
          )}

          {/* ── Decision 1: status ── */}
          <div style={{ padding: "0 24px 18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <h3 style={sectionLabel}>Triage decision</h3>
              {acceptable && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onAccept(event.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accept all suggestions
                </Button>
              )}
            </div>
            <TriageStatusControl
              status={event.triage_status}
              pending={pending}
              disallow={positive ? ["scoring"] : undefined}
              disallowReason="Positive-direction events are excluded from risk arithmetic — promoting one would have no effect"
              onChange={(next) => onStatus(event.id, next)}
            />
            {event.triaged_by ? (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 10.5,
                  color: "var(--p-text-muted)",
                }}
              >
                Triaged by {event.triaged_by} ·{" "}
                {event.triaged_at ? formatDate(event.triaged_at) : "—"}
                {event.triage_status === "scoring" &&
                  " · approved and verified in one step"}
              </p>
            ) : null}
          </div>

          {/* ── Decision 2: category ── */}
          <div style={{ padding: "0 24px 18px" }}>
            <h3 style={{ ...sectionLabel, marginBottom: 8 }}>Scoring pillar</h3>
            {event.triage_status === "scoring" ? (
              <>
                <PillarSelect
                  value={event.primary_category}
                  disabled={pending}
                  onChange={(next) => onCategory(event.id, next)}
                  onNone={() => onStatus(event.id, "display_only")}
                />
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 10.5,
                    lineHeight: 1.45,
                    color: "var(--p-text-muted)",
                  }}
                >
                  {event.suggested_category && (
                    <>
                      Engine suggested{" "}
                      <strong style={{ fontWeight: 600, color: "var(--p-text)" }}>
                        {pillarMeta(event.suggested_category).label}
                      </strong>
                      {event.primary_category === event.suggested_category ? (
                        " — accepted."
                      ) : (
                        <span style={{ color: "var(--p-accent-deep)" }}>
                          {" "}
                          — corrected to{" "}
                          {event.primary_category
                            ? pillarMeta(event.primary_category).label
                            : "none"}
                          .
                        </span>
                      )}{" "}
                    </>
                  )}
                  An event affects several pillars but scores in one.
                </p>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {event.suggested_category ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: "var(--p-text-xs, 12px)",
                        color: "var(--p-text-muted)",
                      }}
                    >
                      Suggested
                    </span>
                    <PillarChip pillar={event.suggested_category} format="long" />
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: "var(--p-text-xs, 12px)",
                      fontStyle: "italic",
                      color: "var(--p-text-muted)",
                    }}
                  >
                    No pillar suggested.
                  </span>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: 10.5,
                    lineHeight: 1.45,
                    color: "var(--p-text-muted)",
                  }}
                >
                  {/* Never point at Approve when the refusal has disabled it — a
                      positive-direction event can never carry a scoring pillar,
                      so "approve to assign one" would send the triager at a dead
                      control the banner just explained is a no-op. */}
                  {positive
                    ? "Positive-direction events are excluded from risk arithmetic, so no scoring pillar can be assigned."
                    : event.triage_status === "display_only"
                      ? "Display-only events are attributed to no pillar by definition — approve for scoring to assign one."
                      : "Approve this event for scoring to confirm or change its pillar."}
                </p>
              </div>
            )}
          </div>

          {/* ── Decision 3: links ── */}
          <div style={{ padding: "0 24px 18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <h3 style={sectionLabel}>Entity links</h3>
              <span style={{ fontSize: 10, color: "var(--p-text-muted)" }}>
                {confirmedLinks.length} confirmed · {suggestedLinks.length}{" "}
                suggested
              </span>
            </div>

            {event.links.length === 0 ? (
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "var(--p-text-xs, 12px)",
                  fontStyle: "italic",
                  color: "var(--p-text-muted)",
                }}
              >
                No links suggested. Attach a material below, or triage this
                event to display-only — an event can be worth showing without
                mapping to a specific material.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {LINK_GROUPS.map((g) => (
                  <LinkGroup
                    key={g.kind}
                    title={g.title}
                    links={event.links.filter((l) => l.kind === g.kind)}
                    pending={pending}
                    onSetStatus={onLinkStatus}
                  />
                ))}
              </div>
            )}

            {/* The add control sits OUTSIDE the empty-state branch on purpose.
                It used to be absent entirely, which meant an event with no
                suggested link offered no way to create one — exactly the case
                where attaching one by hand matters most. */}
            {adding ? (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <MaterialPicker
                  client={api}
                  excludeIds={linkedMaterialIds}
                  disabled={attaching || pending}
                  onPick={(m) => void attachMaterial(m.id)}
                />
                {attachError && (
                  <span style={{ fontSize: 10.5, color: "var(--p-risk-crit)" }}>
                    {attachError}
                  </span>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={attaching}
                    onClick={() => {
                      setAdding(false);
                      setAttachError(null);
                    }}
                  >
                    {attaching ? "Attaching…" : "Cancel"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                style={{ marginTop: 8 }}
                disabled={pending}
                onClick={() => setAdding(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add material link
              </Button>
            )}

            {event.geography_codes.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={microLabel}>Geography</span>
                {/* This was a bespoke mono chip that showed the bare code and
                    nothing else — hovering it said "Primary geography" but
                    never what the country actually was, so an operator had to
                    already know the ISO table to read the row. CountrySharePill
                    is the pill every other geography surface in the app uses
                    (materials, material detail, dashboard KPI, market scores):
                    flag, code, and the full name on hover. The primary /
                    secondary distinction that the old chip carried in its
                    border weight moves into the tooltip, where it is stated
                    rather than implied. */}
                <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {event.geography_codes.map((c, i) => (
                    <CountrySharePill
                      key={c}
                      code={c}
                      name={event.geography_names?.[c]}
                      note={
                        i === 0
                          ? "Primary geography"
                          : "Also affected — recorded as a secondary geography"
                      }
                    />
                  ))}
                </span>
              </div>
            )}
          </div>

          {/* ── Locked in v1 ── */}
          <div style={{ padding: "0 24px 18px" }}>
            <h3 style={{ ...sectionLabel, marginBottom: 2 }}>Machine-assigned</h3>
            <LockedField
              label="Event type"
              value={
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: "var(--p-badge-h, 20px)",
                    padding: "0 7px",
                    borderRadius: 3,
                    border: "1px solid var(--p-border)",
                    background: "var(--p-card)",
                    fontSize: "var(--p-text-2xs, 11px)",
                    fontWeight: 500,
                    color: "var(--p-text-muted)",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                  }}
                >
                  {typeLabel}
                </span>
              }
              why="Locked in triage v1 — deferred deliberately. Event type is machine-suggested and not editable here."
            />
            <LockedField
              label="Severity"
              value={<SeverityChip score={event.severity_score} />}
              why="Locked in triage v1 — deferred deliberately. Severity calibration is machine-assigned."
            />
            <LockedField
              label="Confidence"
              value={<ConfidenceChip score={event.confidence_score} />}
              why="Locked in triage v1 — deferred deliberately. Confidence is machine-assigned."
            />
            <LockedField
              label="Pillars affected"
              value={
                event.risk_categories.length ? (
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {event.risk_categories.map((p) => (
                      <PillarChip key={p} pillar={p} />
                    ))}
                  </span>
                ) : (
                  <span style={{ color: "var(--p-text-faint)" }}>—</span>
                )
              }
              why="The set of pillars an event touches is derived at ingest; only the single scoring pillar is a triage decision."
            />
            <LockedField
              label="Relevance weights"
              value={
                <span style={{ color: "var(--p-text-muted)" }}>
                  Shown per link above
                </span>
              }
              why="Locked in triage v1 — deferred deliberately. Link relevance weights are machine-assigned."
            />
          </div>

          {/* ── Provenance ── */}
          <div style={{ padding: "0 24px 18px" }}>
            <h3 style={{ ...sectionLabel, marginBottom: 2 }}>Provenance</h3>
            <ProvenanceRow
              label="Source system"
              value={event.source_system || "(uncredited source)"}
            />
            <ProvenanceRow
              label="Source"
              value={
                event.source_url ? (
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      color: "var(--p-accent-deep)",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    View source <ExternalLink size={12} strokeWidth={2} />
                  </a>
                ) : (
                  <span
                    title={
                      event.quality_defects.includes("no_provenance")
                        ? "No source document was ever created for this event"
                        : "Points at a bulk document with no URL"
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontStyle: "italic",
                      color: "var(--p-risk-mod)",
                      cursor: "help",
                    }}
                  >
                    <Unlink size={13} strokeWidth={2} /> No source link
                  </span>
                )
              }
            />
            {/* The provenance block records what the machine assigned, so it
                shows the code the resolver actually wrote — but a bare code
                alone is unreadable to anyone who does not already know the ISO
                table, which is the same complaint the chips above answered.
                Name first, code after in mono, and the code alone when the
                reference table has no row for it (rendering a name we do not
                have would be worse than showing the raw value). */}
            <ProvenanceRow
              label="Geography"
              value={
                event.geography_primary ? (
                  <span
                    style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}
                  >
                    {event.geography_names?.[event.geography_primary] && (
                      <span>{event.geography_names[event.geography_primary]}</span>
                    )}
                    <span
                      style={{
                        fontFamily: "var(--p-font-mono)",
                        color: event.geography_names?.[event.geography_primary]
                          ? "var(--p-text-muted)"
                          : "var(--p-text)",
                      }}
                    >
                      {event.geography_primary}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <ProvenanceRow
              label="Event date"
              value={
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {event.event_date ? formatDate(event.event_date) : "—"}
                </span>
              }
            />
            {event.suggested_subtype && (
              <ProvenanceRow
                label="Suggested subtype"
                value={humanize(event.suggested_subtype)}
              />
            )}
          </div>

          {/* ── Duplicate check ── */}
          <div style={{ padding: "0 24px 20px" }}>
            <h3 style={{ ...sectionLabel, marginBottom: 8 }}>Duplicate check</h3>
            {hintsLoading ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--p-text-xs, 12px)",
                  color: "var(--p-text-muted)",
                }}
              >
                Checking for duplicate candidates…
              </p>
            ) : hints == null ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--p-text-xs, 12px)",
                  fontStyle: "italic",
                  color: "var(--p-text-faint)",
                }}
              >
                Duplicate check unavailable.
              </p>
            ) : !hints.checked ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--p-text-xs, 12px)",
                  color: "var(--p-text-muted)",
                }}
              >
                Not checked{hints.reason ? " — " + hints.reason : "."}
              </p>
            ) : hints.hints.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--p-text-xs, 12px)",
                  color: "var(--p-text-muted)",
                }}
              >
                No duplicate candidates found.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "var(--p-text-xs, 12px)",
                    fontWeight: 600,
                    color: "var(--p-risk-mod)",
                  }}
                >
                  <Copy size={13} strokeWidth={2} />
                  {hints.hints.length} duplicate candidate
                  {hints.hints.length === 1 ? "" : "s"} — promoting both would
                  double-count this story
                </span>
                {hints.hints.map((h, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: "var(--p-text-xs, 12px)",
                      color: "var(--p-text)",
                      paddingLeft: 19,
                    }}
                  >
                    {hintTitle(h)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Data-quality notes ──
             Notes used to be write-only: the drawer could file one and the
             footer showed a count, but nothing ever rendered the text back.
             The backend now serves them on the event (TriageFlagRead), so the
             "Flag issue" control lives here, next to what it produces, rather
             than in the footer. */}
          <div style={{ padding: "0 24px 20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <h3 style={sectionLabel}>Data-quality notes</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFlagOpen(true)}
              >
                <Flag className="h-3.5 w-3.5" />
                Flag issue
              </Button>
            </div>
            {event.flags.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--p-text-xs, 12px)",
                  fontStyle: "italic",
                  color: "var(--p-text-muted)",
                }}
              >
                No notes on this event.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {event.flags.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      borderRadius: "var(--p-radius-md, 6px)",
                      border: "1px solid rgba(225, 29, 72, 0.2)",
                      background: "var(--p-risk-crit-soft)",
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "#9F1239",
                        }}
                      >
                        {humanize(n.note_type)}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          color: "#9F1239",
                          opacity: 0.75,
                        }}
                      >
                        {/* Both fields are nullable in the API — a note filed by
                           an automated check has no author, and older rows
                           predate the timestamp. Drop the separator rather than
                           printing "null · null". */}
                        {[n.author, n.created_at ? formatDate(n.created_at) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--p-text-xs, 12px)",
                        lineHeight: 1.5,
                        color: "#881337",
                      }}
                    >
                      {n.note_text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ──
             Only rendered when there is something to say. With "Flag issue"
             moved up into the notes section the footer would otherwise be a
             bare rule across the bottom of the sheet on every non-approved
             event. */}
          {event.triage_status === "scoring" && (
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                borderTop: "1px solid var(--p-border)",
                padding: "12px 24px",
              }}
            >
              <span
                title="Approving an event marks it verified in the same write — operational scoring reads this flag"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "var(--p-text-xs, 12px)",
                  color: "#065F46",
                  cursor: "help",
                }}
              >
                <CheckCircle2 size={13} strokeWidth={2.25} /> Verified on
                approval
              </span>
            </div>
          )}
        </div>
      </SideSheetContent>

      {/* ── Flag issue dialog ── */}
      <Dialog
        open={flagOpen}
        onOpenChange={(next) => {
          if (!next) setFlagOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Flag a data-quality issue</DialogTitle>
            <DialogDescription>{event.title}</DialogDescription>
          </DialogHeader>
          <textarea
            rows={4}
            autoFocus
            value={flagText}
            onChange={(e) => setFlagText(e.target.value)}
            placeholder="What is wrong with this event?"
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: "var(--p-radius-md)",
              border: "1px solid var(--p-border)",
              background: "var(--p-card)",
              padding: "8px 10px",
              fontFamily: "var(--p-font-sans)",
              fontSize: "var(--p-text-xs, 12px)",
              color: "var(--p-text)",
              lineHeight: 1.5,
            }}
          />
          {flagError && (
            <span style={{ fontSize: 10.5, color: "var(--p-risk-crit)" }}>
              {flagError}
            </span>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFlagOpen(false)}
              disabled={flagSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void submitFlag()}
              disabled={!flagText.trim() || flagSubmitting}
            >
              {flagSubmitting ? "Filing..." : "Flag issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SideSheet>
  );
}
