"use client";

/**
 * Geographic-footprint drawer (2026-07-22). Opens from a GeoRow click,
 * lists that country's facilities in detail: name/type, status (colored),
 * location, the material(s) each handles as band chips (same shape as the
 * footprint chips), a Google-Maps link when coordinates exist, and a
 * muted data-source line. Fetched lazily on open. Right side sheet.
 */

import { useEffect, useState } from "react";
import { SideSheet, SideSheetContent } from "@/components/ui/side-sheet";
import { DialogTitle } from "@/components/ui/dialog";
import {
  getCompanyCountryFacilities,
  type CompanyCountryFacilitiesOut,
  type FacilityDetailOut,
} from "@/lib/api/entities";

const LEVEL_LABEL: Record<string, string> = {
  crit: "Crit", high: "High", med: "Mod", low: "Low",  // Mod not Med (2026-09-24)
};

function FacilityCard({ f }: { f: FacilityDetailOut }) {
  return (
    <div className="ih-fd-card">
      <div className="ih-fd-head">
        <span className="ih-fd-name">{f.name || f.facility_type}</span>
        <span className={`ih-fd-status ih-fac-status-${f.status_level}`}>{f.status}</span>
      </div>
      <div className="ih-fd-meta">
        <span className="ih-fd-type">{f.facility_type}</span>
        {f.place ? <span className="ih-fd-place">· {f.place}</span> : null}
      </div>
      {f.materials.length ? (
        <div className="ih-geo-mats ih-fd-mats">
          {f.materials.map((m) => (
            <span key={m.material} className={`ih-geo-mat-chip ih-geo-chip-${m.level}`}>
              {m.material} · {LEVEL_LABEL[m.level]}
            </span>
          ))}
        </div>
      ) : null}
      {f.latitude != null && f.longitude != null ? (
        <div className="ih-fd-foot">
          <a
            className="ih-fd-map"
            href={`https://www.google.com/maps/search/?api=1&query=${f.latitude},${f.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Map ↗
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function FacilityDrawer({
  slug,
  country,
  open,
  onOpenChange,
}: {
  slug: string;
  country: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [data, setData] = useState<CompanyCountryFacilitiesOut | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    setError(false);
    getCompanyCountryFacilities(slug, country)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [open, slug, country]);

  const facs = data?.facilities ?? [];
  const types = [...new Set(facs.map((f) => f.facility_type))];

  return (
    <SideSheet open={open} onOpenChange={onOpenChange}>
      <SideSheetContent className="ih-drawer-content">
        <div className="ih-root ih-drawer">
          <div className="ih-drawer-head">
            <div className="ih-eyebrow">Geographic footprint</div>
            <DialogTitle className="ih-drawer-title">
              {facs.length
                ? `${facs.length} ${facs.length === 1 ? "Facility" : "Facilities"} in ${data?.country_name ?? country}`
                : `Facilities in ${data?.country_name ?? country}`}
            </DialogTitle>
            {facs.length ? (
              <p className="ih-drawer-sub">{types.join(", ")}</p>
            ) : null}
          </div>

          {error ? (
            <p className="ih-fd-note">Couldn’t load facilities — please try again.</p>
          ) : data === null ? (
            <p className="ih-fd-note">Loading…</p>
          ) : facs.length === 0 ? (
            <p className="ih-fd-note">No tracked facilities in {country}.</p>
          ) : (
            <div className="ih-fd-list">
              {facs.map((f, i) => (
                <FacilityCard key={i} f={f} />
              ))}
            </div>
          )}
        </div>
      </SideSheetContent>
    </SideSheet>
  );
}
