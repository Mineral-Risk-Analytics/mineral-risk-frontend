"use client";

/**
 * Operational promotion dialog.
 *
 * Events with event_type === "operational_news_candidate" arrive from the
 * news pipeline with subtype and severity unset — the ordinary Approve
 * transition cannot supply them, so approval routes through this dialog and
 * calls promote-operational instead (which sets triage_status='scoring' AND
 * verified=True in the same write: approving IS verifying).
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getOperationalSubtypes,
  promoteOperational,
  type OperationalSubtype,
  type TriageEvent,
} from "@/lib/api/triage";
import { useTriageApi } from "@/lib/hooks/use-triage";

export interface PromoteOperationalDialogProps {
  open: boolean;
  event: TriageEvent | null;
  onClose: () => void;
  /** Called after a successful promote so the page can refetch list + summary. */
  onPromoted: () => void;
}

export function PromoteOperationalDialog({
  open,
  event,
  onClose,
  onPromoted,
}: PromoteOperationalDialogProps) {
  const api = useTriageApi();

  const [subtypes, setSubtypes] = useState<OperationalSubtype[]>([]);
  const [loadingLadder, setLoadingLadder] = useState(false);
  const [ladderError, setLadderError] = useState<string | null>(null);

  const [subtype, setSubtype] = useState("");
  const [severityText, setSeverityText] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingLadder(true);
    setLadderError(null);
    setSeverityText("");
    setNote("");
    setSubmitError(null);
    getOperationalSubtypes(api)
      .then((ladder) => {
        if (cancelled) return;
        setSubtypes(ladder);
        const suggested = event?.suggested_subtype ?? "";
        setSubtype(
          suggested && ladder.some((s) => s.value === suggested) ? suggested : "",
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLadderError(
          err instanceof Error ? err.message : "Could not load subtypes",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingLadder(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, event?.id, event?.suggested_subtype, api]);

  const selected = useMemo(
    () => subtypes.find((s) => s.value === subtype) ?? null,
    [subtypes, subtype],
  );

  const severityValue = severityText.trim() === "" ? null : Number(severityText);
  const severityInvalid =
    severityValue != null &&
    (Number.isNaN(severityValue) || severityValue < 0 || severityValue > 1);

  const canPromote =
    !!event && !!subtype && !severityInvalid && !submitting && !loadingLadder;

  const handlePromote = async () => {
    if (!event || !subtype) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await promoteOperational(api, event.id, {
        subtype,
        ...(severityValue != null && !severityInvalid
          ? { severity: severityValue }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onPromoted();
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Promote operational candidate</DialogTitle>
          <DialogDescription>
            News candidates arrive with subtype and severity unset — approval
            supplies them.
          </DialogDescription>
        </DialogHeader>

        {event && (
          <p
            style={{
              margin: 0,
              fontSize: "var(--p-text-xs, 12px)",
              color: "var(--p-text-muted)",
              lineHeight: 1.5,
            }}
          >
            {event.title}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              htmlFor="promote-subtype"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--p-text-muted)",
              }}
            >
              Subtype
            </label>
            <Select
              value={subtype}
              onValueChange={setSubtype}
              disabled={loadingLadder || subtypes.length === 0}
            >
              <SelectTrigger id="promote-subtype" className="h-9 w-full">
                <SelectValue
                  placeholder={
                    loadingLadder ? "Loading subtypes..." : "Choose a subtype"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {subtypes.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "var(--p-text-2xs, 11px)",
                        color: "var(--p-text-muted)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      default {s.default_severity.toFixed(2)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ladderError && (
              <span style={{ fontSize: 10.5, color: "var(--p-risk-crit)" }}>
                {ladderError}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              htmlFor="promote-severity"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--p-text-muted)",
              }}
            >
              Severity override (optional)
            </label>
            <Input
              id="promote-severity"
              type="number"
              min={0}
              max={1}
              step={0.05}
              inputMode="decimal"
              placeholder={
                selected ? selected.default_severity.toFixed(2) : "0.00 – 1.00"
              }
              value={severityText}
              onChange={(e) => setSeverityText(e.target.value)}
              className="h-9"
            />
            <span
              style={{
                fontSize: 10.5,
                color: severityInvalid
                  ? "var(--p-risk-crit)"
                  : "var(--p-text-muted)",
              }}
            >
              {severityInvalid
                ? "Severity must be between 0 and 1."
                : "Leave blank to use the subtype default."}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              htmlFor="promote-note"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--p-text-muted)",
              }}
            >
              Note (optional)
            </label>
            <textarea
              id="promote-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this subtype / severity, if not obvious from the story"
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
          </div>

          {submitError && (
            <span style={{ fontSize: 10.5, color: "var(--p-risk-crit)" }}>
              {submitError}
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handlePromote()} disabled={!canPromote}>
            {submitting ? "Promoting..." : "Promote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
