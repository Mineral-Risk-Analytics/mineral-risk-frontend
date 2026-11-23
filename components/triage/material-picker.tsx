"use client";

/**
 * Search-backed material picker for attaching a link during triage.
 *
 * The design mock chose from a hard-coded in-memory list; the real corpus is
 * far too large for that, so this searches `GET /api/v1/materials` (the same
 * endpoint the materials page uses — no new backend surface). Results are
 * debounced, and materials already linked on the event are filtered out so a
 * triager cannot create a duplicate link and then wonder why nothing changed.
 *
 * Rendered inline rather than in a popover on purpose: the drawer is itself a
 * Radix portal, and nesting a second portal inside it puts the results list
 * outside the sheet's focus scope.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { getMaterials } from "@/lib/api/materials";
import type { ApiClient } from "@/lib/api/client";
import type { MaterialListItem } from "@/lib/types";

export interface MaterialPickerProps {
  client: ApiClient;
  /** Material ids already linked on this event — excluded from results. */
  excludeIds: number[];
  onPick: (material: MaterialListItem) => void;
  disabled?: boolean;
}

export function MaterialPicker({
  client,
  excludeIds,
  onPick,
  disabled,
}: MaterialPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MaterialListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    const mine = ++seq.current;
    setError(null);
    setLoading(true);
    // Empty query still fetches: an operator who has no particular material in
    // mind should see the launch-list ten rather than an empty box.
    const handle = setTimeout(() => {
      getMaterials(client, {
        page: 1,
        limit: 20,
        search: query.trim() || undefined,
        ...(query.trim() ? {} : { is_launch_list: true }),
      })
        .then((res) => {
          if (mine !== seq.current) return;
          setResults(res.data ?? []);
        })
        .catch(() => {
          if (mine !== seq.current) return;
          setResults([]);
          setError("Could not load materials");
        })
        .finally(() => {
          if (mine === seq.current) setLoading(false);
        });
    }, 220);
    return () => clearTimeout(handle);
  }, [client, query]);

  const visible = results.filter((m) => !exclude.has(m.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        <Search
          size={13}
          strokeWidth={2}
          aria-hidden
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--p-text-faint)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          autoFocus
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search materials…"
          aria-label="Search materials"
          style={{
            width: "100%",
            height: 30,
            paddingLeft: 26,
            paddingRight: 8,
            borderRadius: "var(--p-radius-md)",
            border: "1px solid var(--p-border)",
            background: "var(--p-card)",
            fontFamily: "var(--p-font-sans)",
            fontSize: "var(--p-text-xs, 12px)",
            color: "var(--p-text)",
          }}
        />
      </div>

      <div
        role="listbox"
        aria-label="Material results"
        style={{
          maxHeight: 176,
          overflowY: "auto",
          borderRadius: "var(--p-radius-md)",
          border: "1px solid var(--p-border)",
          background: "var(--p-card)",
        }}
      >
        {error ? (
          <p style={emptyStyle}>{error}</p>
        ) : loading && visible.length === 0 ? (
          <p style={emptyStyle}>Searching…</p>
        ) : visible.length === 0 ? (
          <p style={emptyStyle}>
            {query.trim()
              ? "No unlinked material matches that."
              : "No materials available."}
          </p>
        ) : (
          visible.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={false}
              disabled={disabled}
              onClick={() => onPick(m)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 10px",
                border: "none",
                borderBottom: "1px solid var(--p-rule)",
                background: "transparent",
                textAlign: "left",
                fontFamily: "var(--p-font-sans)",
                fontSize: "var(--p-text-xs, 12px)",
                color: "var(--p-text)",
                cursor: disabled ? "default" : "pointer",
              }}
            >
              <span
                style={{
                  minWidth: 0,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.canonical_name}
              </span>
              {m.symbol_or_code && (
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: "var(--p-font-mono)",
                    fontSize: 9.5,
                    color: "var(--p-text-faint)",
                  }}
                >
                  {m.symbol_or_code}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const emptyStyle = {
  margin: 0,
  padding: "10px",
  fontSize: "var(--p-text-xs, 12px)",
  fontStyle: "italic",
  color: "var(--p-text-muted)",
} as const;
