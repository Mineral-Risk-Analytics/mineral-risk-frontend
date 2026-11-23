"use client";

/**
 * Admin — insight post editor (two-pane, per 2026-07-08 decisions).
 * Left: Markdown source + chart configuration + metadata.
 * Right: live preview using the SAME ArticleRenderer as the public page.
 * Charts: fenced ```chart blocks in the body; the ChartConfig panel lists
 * every block and edits its JSON spec in place (type, title, data, source).
 */

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { useMaterials } from "@/lib/hooks/use-materials";
import {
  getPostById,
  getImageUploadUrl,
  getPdfUploadUrl,
  updatePost,
  publishPost,
  unpublishPost,
  archivePost,
  pinPost,
  unpinPost,
} from "@/lib/api/insights";
import ArticleRenderer from "@/components/insights/ArticleRenderer";
import { TagPicker } from "@/components/admin/tag-picker";
import { FacetPicker } from "@/components/admin/facet-picker";
import { suggestMaterials, suggestGeographies } from "@/lib/api/insights";
import type { ChartSpec } from "@/components/insights/ChartBlock";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CHART_FENCE_G = /```chart\s*\n([\s\S]*?)\n```/g;

function extractCharts(body: string): { index: number; spec: ChartSpec }[] {
  const out: { index: number; spec: ChartSpec }[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  const re = new RegExp(CHART_FENCE_G.source, "g");
  while ((m = re.exec(body)) !== null) {
    let spec: ChartSpec = { type: "unconfigured" };
    try {
      spec = JSON.parse(m[1] ?? "");
    } catch {
      /* leave unconfigured */
    }
    out.push({ index: i++, spec });
  }
  return out;
}

function replaceChartSpec(body: string, index: number, spec: ChartSpec): string {
  let i = 0;
  return body.replace(new RegExp(CHART_FENCE_G.source, "g"), (full) =>
    i++ === index ? "```chart\n" + JSON.stringify(spec) + "\n```" : full,
  );
}

/** CSV/TSV paste → [{label, value}] */
function parseCsv(text: string): { label: string; value: number }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/[,\t]/).map((s) => s?.trim() ?? "");
      return { label: parts[0] ?? "", value: Number(parts[1] ?? NaN) };
    })
    .filter((d) => d.label !== "" && Number.isFinite(d.value));
}

function ChartConfigPanel({
  body,
  onChange,
}: {
  body: string;
  onChange: (next: string) => void;
}) {
  const charts = extractCharts(body);
  if (charts.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        No chart blocks. Add <code>[[chart: name]]</code> in the source (as a
        chart fence) to place one.
      </p>
    );
  return (
    <div className="space-y-4">
      {charts.map(({ index, spec }) => (
        <div key={index} className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              {spec.name ?? `chart ${index + 1}`}
            </span>
            <Badge variant={spec.type === "unconfigured" ? "destructive" : "outline"}>
              {spec.type}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <select
              value={spec.type}
              onChange={(e) =>
                onChange(replaceChartSpec(body, index, { ...spec, type: e.target.value }))
              }
              className="rounded-md border bg-background px-2 py-1"
            >
              <option value="unconfigured">unconfigured</option>
              <option value="bar">bar</option>
              <option value="line">line</option>
              <option value="area">area</option>
              <option value="donut">donut</option>
            </select>
            <select
              value={spec.size ?? "full"}
              onChange={(e) =>
                onChange(
                  replaceChartSpec(body, index, {
                    ...spec,
                    size: e.target.value as ChartSpec["size"],
                  }),
                )
              }
              className="rounded-md border bg-background px-2 py-1"
            >
              <option value="full">full width</option>
              <option value="inline">inline (floated)</option>
            </select>
            <input
              placeholder="Title"
              value={spec.title ?? ""}
              onChange={(e) =>
                onChange(replaceChartSpec(body, index, { ...spec, title: e.target.value }))
              }
              className="col-span-2 rounded-md border bg-background px-2 py-1"
            />
            <input
              placeholder="Source line (e.g. CMOC AR 2025)"
              value={spec.source ?? ""}
              onChange={(e) =>
                onChange(replaceChartSpec(body, index, { ...spec, source: e.target.value }))
              }
              className="col-span-2 rounded-md border bg-background px-2 py-1"
            />
            <input
              placeholder="dataRef (live platform series, optional)"
              value={spec.dataRef ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const next: ChartSpec = { ...spec };
                if (v) next.dataRef = v;
                else delete next.dataRef;
                onChange(replaceChartSpec(body, index, next));
              }}
              className="col-span-2 rounded-md border bg-background px-2 py-1"
            />
            <textarea
              placeholder={"Paste data: label,value per line\nDRC,76\nOther,24"}
              defaultValue={(spec.data ?? [])
                .map((d) => `${d.label},${d.value}`)
                .join("\n")}
              onBlur={(e) => {
                const data = parseCsv(e.target.value);
                const next: ChartSpec = { ...spec };
                if (data.length) next.data = data;
                else delete next.data;
                onChange(replaceChartSpec(body, index, next));
              }}
              rows={4}
              className="col-span-2 rounded-md border bg-background px-2 py-1 font-mono text-xs"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminInsightEditorPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useApiClient();
  const qc = useQueryClient();

  const post = useQuery({
    queryKey: ["insights", "post", id],
    queryFn: () => getPostById(client, id),
    enabled: Number.isFinite(id),
  });

  const [body, setBody] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState<string | null>(null);
  // Tag fields are edited as comma-separated text; parsed on save.
  // Array state (2026-07-22): materials + geographies moved from
  // comma-text to FacetPicker (real-data autocomplete, exact values).
  const [materials, setMaterials] = React.useState<string[] | null>(null);
  const [geographies, setGeographies] = React.useState<string[] | null>(null);
  // Array state (2026-07-22): tags moved from comma-text to the TagPicker
  // (entity autocomplete — see components/admin/tag-picker.tsx).
  const [tags, setTags] = React.useState<string[] | null>(null);
  // Defensive normalization: after the string→array refactor, hot reload
  // can leave the OLD comma-joined string in preserved React state (it
  // did, 2026-07-22 — "(tags ?? []).join is not a function"). Coerce
  // whatever is in state to an array instead of trusting the TS type.
  const tagList: string[] = React.useMemo(() => {
    if (Array.isArray(tags)) return tags;
    if (typeof tags === "string") {
      return (tags as string).split(",").map((t) => t.trim()).filter(Boolean);
    }
    return [];
  }, [tags]);
  // Same hot-reload-safe coercion as tagList (string→array survival).
  const materialList: string[] = React.useMemo(() => {
    if (Array.isArray(materials)) return materials;
    if (typeof materials === "string")
      return (materials as string).split(",").map((t) => t.trim()).filter(Boolean);
    return [];
  }, [materials]);
  const geoList: string[] = React.useMemo(() => {
    if (Array.isArray(geographies)) return geographies;
    if (typeof geographies === "string")
      return (geographies as string).split(",").map((t) => t.trim()).filter(Boolean);
    return [];
  }, [geographies]);
  const [pillar, setPillar] = React.useState<string | null>(null);
  // Publishing details (admin content v1, 2026-07-21)
  const [contentType, setContentType] = React.useState<string | null>(null);
  const [riskBand, setRiskBand] = React.useState<string | null>(null);
  const [author, setAuthor] = React.useState<string | null>(null);
  const [readTime, setReadTime] = React.useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [heroImageUrl, setHeroImageUrl] = React.useState<string | null>(null);
  const [slugValue, setSlugValue] = React.useState<string | null>(null);
  // Article (written) date, "YYYY-MM-DD"; "" = unset (publish stamps now).
  const [articleDate, setArticleDate] = React.useState<string | null>(null);
  // Slug locks once the post has ever been published (published OR
  // archived-after-publish); "Change slug" + warning unlocks for this edit.
  const [slugUnlocked, setSlugUnlocked] = React.useState(false);
  React.useEffect(() => {
    if (post.data && body === null) {
      setBody(post.data.body ?? "");
      setSummary(post.data.summary ?? "");
      setTitle(post.data.title ?? "");
      setMaterials(post.data.materials ?? []);
      setGeographies(post.data.geographies ?? []);
      setTags(post.data.tags ?? []);
      setPillar(post.data.pillar ?? "");
      setContentType(post.data.content_type);
      setRiskBand(post.data.risk_band ?? "");
      setAuthor(post.data.author ?? "");
      setReadTime(
        post.data.read_time_minutes != null ? String(post.data.read_time_minutes) : "",
      );
      setPdfUrl(post.data.pdf_url ?? "");
      setHeroImageUrl(post.data.hero_image_url ?? "");
      setSlugValue(post.data.slug);
      setArticleDate(post.data.published_at ? post.data.published_at.slice(0, 10) : "");
    }
  }, [post.data, body]);

  // Legacy material-tag validator (2026-11-23). The FacetPicker is
  // pick-only, so NEW tags always match the register — but posts tagged
  // before it existed (pre-2026-07-22) carry symbols ("LI") or other
  // non-canonical strings, and those silently break ALL linking: the
  // article's Related Signals lookup, the material page's Linked
  // intelligence, and the chip's /materials/{slug} target. Flag them
  // against the register with a one-click replacement; never blocks Save.
  const materialRegister = useMaterials({ limit: 100 });
  const invalidMaterials = React.useMemo(() => {
    const rows = materialRegister.data?.data;
    if (!rows?.length) return [];
    const byName = new Set(rows.map((m) => m.canonical_name));
    return materialList
      .filter((v) => !byName.has(v))
      .map((v) => {
        const q = v.trim().toLowerCase();
        const match =
          rows.find((m) => (m.symbol_or_code ?? "").toLowerCase() === q) ??
          rows.find((m) => m.canonical_name.toLowerCase() === q) ??
          rows
            .filter((m) => m.canonical_name.toLowerCase().startsWith(q))
            .sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
        return { value: v, suggestion: match?.canonical_name ?? null };
      });
  }, [materialList, materialRegister.data]);
  function replaceMaterial(from: string, to: string) {
    // Map then dedupe — replacing "LI" with "Lithium" when "Lithium" is
    // already tagged must not create a duplicate chip.
    setMaterials(
      Array.from(new Set(materialList.map((m) => (m === from ? to : m)))),
    );
  }

  const dirty =
    post.data != null &&
    (body !== (post.data.body ?? "") ||
      summary !== (post.data.summary ?? "") ||
      title !== (post.data.title ?? "") ||
      materialList.join("\u0000") !== (post.data.materials ?? []).join("\u0000") ||
      geoList.join("\u0000") !== (post.data.geographies ?? []).join("\u0000") ||
      tagList.join("\u0000") !== (post.data.tags ?? []).join("\u0000") ||
      pillar !== (post.data.pillar ?? "") ||
      (contentType !== null && contentType !== post.data.content_type) ||
      riskBand !== (post.data.risk_band ?? "") ||
      author !== (post.data.author ?? "") ||
      readTime !==
        (post.data.read_time_minutes != null ? String(post.data.read_time_minutes) : "") ||
      pdfUrl !== (post.data.pdf_url ?? "") ||
      heroImageUrl !== (post.data.hero_image_url ?? "") ||
      articleDate !==
        (post.data.published_at ? post.data.published_at.slice(0, 10) : "") ||
      (slugValue !== null && slugValue !== post.data.slug));

  const [actionError, setActionError] = React.useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updatePost(client, id, {
        body: body ?? "",
        summary: summary ?? "",
        title: title || undefined,
        materials: materialList.length ? materialList : null,
        geographies: geoList.length ? geoList : null,
        tags: tagList.length ? tagList : null,
        pillar: pillar || null,
        content_type: (contentType ||
          undefined) as "analysis" | "signal" | "report" | "news" | undefined,
        risk_band: (riskBand || null) as "low" | "med" | "high" | "crit" | null,
        author: author || null,
        read_time_minutes: readTime?.trim() ? Number(readTime) : null,
        pdf_url: pdfUrl?.trim() ? pdfUrl.trim() : null,
        hero_image_url: heroImageUrl?.trim() ? heroImageUrl.trim() : null,
        // Noon UTC keeps the calendar date stable across viewer timezones.
        published_at: articleDate?.trim() ? `${articleDate}T12:00:00Z` : null,
        // Only send slug when actually changed — avoids spurious 409 paths.
        ...(slugValue !== null && post.data && slugValue !== post.data.slug
          ? { slug: slugValue }
          : {}),
      }),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
    onError: (e) => setActionError(`Save failed: ${e instanceof Error ? e.message : e}`),
  });
  const publish = useMutation({
    // Publish auto-saves pending edits first — one click, no hidden two-step.
    mutationFn: async () => {
      if (dirty) await save.mutateAsync();
      return publishPost(client, id);
    },
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
    onError: (e) =>
      setActionError(`Publish failed: ${e instanceof Error ? e.message : e}`),
  });
  const unpublish = useMutation({
    mutationFn: () => unpublishPost(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });
  const togglePin = useMutation({
    mutationFn: () =>
      post.data?.pinned ? unpinPost(client, id) : pinPost(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });
  const [pdfUploading, setPdfUploading] = React.useState(false);
  async function handlePdfUpload(file: File) {
    setPdfUploading(true);
    setActionError(null);
    try {
      const t = await getPdfUploadUrl(client, id, file.name);
      const res = await fetch(t.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!res.ok) throw new Error(`R2 rejected the upload (HTTP ${res.status})`);
      // Fills the field only — Save persists it, same as any other edit.
      setPdfUrl(t.public_url);
    } catch (e) {
      setActionError(
        `PDF upload failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setPdfUploading(false);
    }
  }
  const [heroUploading, setHeroUploading] = React.useState(false);
  async function handleHeroUpload(file: File) {
    setHeroUploading(true);
    setActionError(null);
    try {
      const t = await getImageUploadUrl(client, id, file.name);
      const res = await fetch(t.upload_url, {
        method: "PUT",
        headers: { "Content-Type": t.content_type },
        body: file,
      });
      if (!res.ok) throw new Error(`R2 rejected the upload (HTTP ${res.status})`);
      // Fills the field only — Save persists it, same as any other edit.
      setHeroImageUrl(t.public_url);
    } catch (e) {
      setActionError(
        `Image upload failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setHeroUploading(false);
    }
  }
  const archive = useMutation({
    mutationFn: () => archivePost(client, id),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
    onError: (e) =>
      setActionError(`Archive failed: ${e instanceof Error ? e.message : e}`),
  });

  if (post.isLoading || body === null)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (post.isError || !post.data)
    return <p className="p-6 text-sm text-destructive">Post not found.</p>;

  const unconfigured = extractCharts(body).filter(
    (c) => c.spec.type === "unconfigured",
  ).length;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{post.data.title}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>/{post.data.slug} · {post.data.content_type} ·</span>
            <Badge variant={post.data.status === "published" ? "default" : "secondary"}>
              {post.data.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {post.data.content_type !== "report" ? (
            <Button
              variant={post.data.pinned ? "secondary" : "outline"}
              onClick={() => togglePin.mutate()}
              disabled={togglePin.isPending}
              title="Pinned posts surface above the date-ordered feed"
            >
              {post.data.pinned ? "📌 Unpin" : "Pin to top"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? "Saving…" : dirty ? "Save draft" : "Saved"}
          </Button>
          {post.data.status === "published" ? (
            <Button variant="secondary" onClick={() => unpublish.mutate()}>
              Unpublish
            </Button>
          ) : (
            <Button
              onClick={() => publish.mutate()}
              disabled={unconfigured > 0 || publish.isPending}
              title={
                unconfigured > 0
                  ? `${unconfigured} chart(s) not configured`
                  : undefined
              }
            >
              {publish.isPending
                ? "Publishing…"
                : dirty
                  ? "Save & publish"
                  : post.data.status === "archived"
                    ? "Republish"
                    : "Publish"}
            </Button>
          )}
          {post.data.status !== "archived" ? (
            <Button
              variant="outline"
              onClick={() => {
                // Native confirm is deliberate: archiving a published post
                // removes it from the public feed immediately.
                const msg =
                  post.data?.status === "published"
                    ? "Archive this post? It will be removed from the public feed immediately."
                    : "Archive this draft?";
                if (window.confirm(msg)) archive.mutate();
              }}
              disabled={archive.isPending}
              title="Removes from the public feed; the post stays here and can be republished"
            >
              {archive.isPending ? "Archiving…" : "Archive"}
            </Button>
          ) : null}
        </div>
      </div>
      {unconfigured > 0 ? (
        <p className="text-sm text-amber-600">
          {unconfigured} chart block(s) still unconfigured — publish is disabled
          until they’re set up below.
        </p>
      ) : null}
      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-3">
            <h2 className="mb-2 text-sm font-semibold">Title</h2>
            <input
              value={title ?? ""}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-3 w-full rounded-md border bg-background p-2 text-sm font-medium"
            />
            <h2 className="mb-2 text-sm font-semibold">Summary (feed card)</h2>
            <textarea
              value={summary ?? ""}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background p-2 text-sm"
            />
            <h2 className="mb-2 mt-4 text-sm font-semibold">Tags & taxonomy</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="col-span-2 text-xs text-muted-foreground">
                Materials (pick from the register — links to material pages & feed filter)
                <FacetPicker
                  value={materialList}
                  onChange={setMaterials}
                  fetcher={suggestMaterials}
                  placeholder="Type a material — e.g. Cobalt, Li"
                />
                {invalidMaterials.length ? (
                  <div className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-500">
                    {invalidMaterials.map((bad) => (
                      <div key={bad.value}>
                        &ldquo;{bad.value}&rdquo; isn&rsquo;t a register
                        material — it won&rsquo;t link to a material page,
                        signals, or the feed filter.{" "}
                        {bad.suggestion ? (
                          <button
                            type="button"
                            className="font-medium underline"
                            onClick={() => replaceMaterial(bad.value, bad.suggestion!)}
                          >
                            Replace with &ldquo;{bad.suggestion}&rdquo;
                          </button>
                        ) : (
                          <>Remove it or pick the right name above.</>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                Geographies (pick a country — stored as ISO2)
                <FacetPicker
                  value={geoList}
                  onChange={setGeographies}
                  fetcher={suggestGeographies}
                  placeholder="Type a country — e.g. China, CD"
                />
              </div>
              <label className="text-xs text-muted-foreground">
                Pillar
                <select
                  value={pillar ?? ""}
                  onChange={(e) => setPillar(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">— none / multi —</option>
                  <option value="material_concentration">Material Concentration</option>
                  <option value="geopolitical_trade">Geopolitical Trade</option>
                  <option value="regulatory_compliance">Regulatory Compliance</option>
                  <option value="operational">Operational</option>
                  <option value="financial_pressure">Financial Pressure</option>
                </select>
              </label>
              <div className="col-span-2 text-xs text-muted-foreground">
                Tags — entity tags (solid, with icon) link this post to the
                public company/regulation page; dashed ones are plain topics
                <TagPicker value={tagList} onChange={setTags} />
              </div>
            </div>
            <h2 className="mb-2 mt-4 text-sm font-semibold">Publishing details</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="text-xs text-muted-foreground">
                Type
                <select
                  value={contentType ?? ""}
                  onChange={(e) => setContentType(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="analysis">Analysis</option>
                  <option value="signal">Signal</option>
                  <option value="report">Report</option>
                  <option value="news">News</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Risk tag (editorial severity, not an engine score)
                <select
                  value={riskBand ?? ""}
                  onChange={(e) => setRiskBand(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">— untagged —</option>
                  <option value="low">Low</option>
                  <option value="med">Med</option>
                  <option value="high">High</option>
                  <option value="crit">Critical</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Author
                <input
                  value={author ?? ""}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="byline"
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Read time (min, blank = auto)
                <input
                  type="number"
                  min={1}
                  value={readTime ?? ""}
                  onChange={(e) => setReadTime(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="col-span-2 text-xs text-muted-foreground">
                Article date (when it was written — blank = stamped at publish)
                <input
                  type="date"
                  value={articleDate ?? ""}
                  onChange={(e) => setArticleDate(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <div className="col-span-2 text-xs text-muted-foreground">
                Hero image
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={heroImageUrl ?? ""}
                    onChange={(e) => setHeroImageUrl(e.target.value)}
                    placeholder="https://…/cover.jpg — or upload →"
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                  <input
                    id="hero-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleHeroUpload(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={heroUploading}
                    onClick={() =>
                      document.getElementById("hero-file-input")?.click()
                    }
                  >
                    {heroUploading ? "Uploading…" : "Upload image"}
                  </Button>
                </div>
                <span className="mt-1 block">
                  Shown at the top of the public article (jpg/png/webp).
                  Upload fills the URL from R2 — remember to Save.
                </span>
                {heroImageUrl?.trim() ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={heroImageUrl.trim()}
                    alt="Hero preview"
                    className="mt-2 max-h-28 rounded-md border object-cover"
                  />
                ) : null}
              </div>
              {contentType === "report" ? (
                <div className="col-span-2 text-xs text-muted-foreground">
                  Report PDF
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={pdfUrl ?? ""}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      placeholder="https://…/report.pdf — or upload →"
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                    />
                    <input
                      id="pdf-file-input"
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePdfUpload(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pdfUploading}
                      onClick={() =>
                        document.getElementById("pdf-file-input")?.click()
                      }
                    >
                      {pdfUploading ? "Uploading…" : "Upload PDF"}
                    </Button>
                  </div>
                  <span className="mt-1 block">
                    Upload fills the URL from R2 — remember to Save. Manual
                    paste still works.
                  </span>
                </div>
              ) : null}
              <label className="col-span-2 text-xs text-muted-foreground">
                Slug (public URL){post.data.status !== "draft" && !slugUnlocked ? " — locked after publish" : ""}
                <div className="mt-1 flex gap-2">
                  <input
                    value={slugValue ?? ""}
                    onChange={(e) =>
                      setSlugValue(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]+/g, "-")
                          .replace(/-{2,}/g, "-"),
                      )
                    }
                    disabled={post.data.status !== "draft" && !slugUnlocked}
                    className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm text-foreground disabled:opacity-60"
                  />
                  {post.data.status !== "draft" && !slugUnlocked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Change the slug of a published post? The current public URL will stop working — there are no redirects. Anyone who bookmarked or shared the old link will get a 404.",
                          )
                        )
                          setSlugUnlocked(true);
                      }}
                    >
                      Change slug
                    </Button>
                  ) : null}
                </div>
              </label>
            </div>
            <h2 className="mb-2 mt-4 text-sm font-semibold">Markdown source</h2>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={24}
              className="w-full rounded-md border bg-background p-2 font-mono text-xs leading-5"
            />
          </Card>
          <Card className="p-3">
            <h2 className="mb-2 text-sm font-semibold">Charts</h2>
            <ChartConfigPanel body={body} onChange={setBody} />
          </Card>
        </div>
        <Card className="max-h-[80vh] overflow-y-auto p-6">
          <p className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <ArticleRenderer body={body} />
        </Card>
      </div>
    </div>
  );
}
