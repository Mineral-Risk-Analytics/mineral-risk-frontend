/**
 * Typed client for the intelligence (insight posts) API — admin surface.
 * Mirrors app/schemas/intelligence.py on the FastAPI side.
 */

import type { ApiClient } from "./client";

export interface InsightPostListItem {
  id: number;
  slug: string;
  title: string;
  content_type: "analysis" | "signal" | "report" | "news";
  pillar: string | null;
  materials: string[] | null;
  geographies: string[] | null;
  summary: string | null;
  read_time_minutes: number | null;
  author: string | null;
  published_at: string | null;
  pinned: boolean;
  hero_image_url: string | null;
  tags: string[] | null;
  /** 2026-07-21: lifecycle state on list rows too — the drafts inbox
   *  returns draft AND archived, and the admin table filters on it. */
  status: "draft" | "published" | "archived";
  /** Editorial risk severity tag (author judgment, NOT a scoring-engine
   *  output). Null = untagged. */
  risk_band: "low" | "med" | "high" | "crit" | null;
}

export interface InsightPostDetail extends InsightPostListItem {
  body: string | null;
  pdf_url: string | null;
}

export interface InsightPostUpdate {
  /** Frontend locks slug after first publish (change-with-warning);
   *  server 409s on collision, 422 on non-slug format. */
  slug?: string;
  content_type?: "analysis" | "signal" | "report" | "news";
  risk_band?: "low" | "med" | "high" | "crit" | null;
  title?: string;
  tags?: string[] | null;
  pillar?: string | null;
  materials?: string[] | null;
  geographies?: string[] | null;
  summary?: string | null;
  body?: string | null;
  pdf_url?: string | null;
  hero_image_url?: string | null;
  read_time_minutes?: number | null;
  author?: string | null;
  /** Article (written) date, ISO — null clears (next publish re-stamps). */
  published_at?: string | null;
}

const BASE = "/api/v1/intelligence";

/** Standard list envelope from app/schemas/common.py: {data, total, page, limit}. */
interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Create an empty draft (admin content v1 — Signals shouldn't need a
 *  Word file). Server 409s on slug collision. */
export async function createPost(
  client: ApiClient,
  body: { slug: string; title: string; content_type: string; published_at?: string },
) {
  const { data } = await client.post<InsightPostDetail>(`${BASE}/posts`, body);
  return data;
}

/** Presigned R2 PUT for a report's PDF. Flow: call this → PUT the file to
 *  upload_url (Content-Type application/pdf) → save public_url as pdf_url. */
export async function getPdfUploadUrl(
  client: ApiClient,
  id: number,
  filename: string,
) {
  const { data } = await client.post<{
    upload_url: string;
    public_url: string;
    key: string;
    expires_in: number;
  }>(`${BASE}/posts/${id}/pdf-upload-url`, { filename });
  return data;
}

export async function getImageUploadUrl(
  client: ApiClient,
  id: number,
  filename: string,
) {
  const { data } = await client.post<{
    upload_url: string;
    public_url: string;
    key: string;
    expires_in: number;
    /** The Content-Type the PUT must send — presign-bound server-side. */
    content_type: string;
  }>(`${BASE}/posts/${id}/image-upload-url`, { filename });
  return data;
}

export interface TagSuggestion {
  /** EXACT string the tag must carry to link (canonical_name / regulation_key). */
  label: string;
  kind: "company" | "regulation";
  hint: string | null;
}

export interface FacetSuggestion {
  value: string; // EXACT stored string: canonical_name / ISO2
  label: string;
  hint: string | null;
}

/** Materials autocomplete (value = canonical_name). */
export async function suggestMaterials(client: ApiClient, q: string) {
  const { data } = await client.get<{ suggestions: FacetSuggestion[] }>(
    `${BASE}/metadata/materials`,
    { params: { q } },
  );
  return data.suggestions;
}

/** Geographies autocomplete (value = ISO2). */
export async function suggestGeographies(client: ApiClient, q: string) {
  const { data } = await client.get<{ suggestions: FacetSuggestion[] }>(
    `${BASE}/metadata/geographies`,
    { params: { q } },
  );
  return data.suggestions;
}

/** Entity-tag autocomplete for the editor's tag picker. */
export async function suggestTags(client: ApiClient, q: string) {
  const { data } = await client.get<{ suggestions: TagSuggestion[] }>(
    `${BASE}/tags/suggest`,
    { params: { q } },
  );
  return data.suggestions;
}

/** Which tags are entity tags (company/regulation) vs plain topic tags. */
export async function classifyTags(client: ApiClient, tags: string[]) {
  const { data } = await client.post<{
    classifications: Record<string, "company" | "regulation" | null>;
  }>(`${BASE}/tags/classify`, { tags });
  return data.classifications;
}

/** Archive: leaves the public feed, keeps the row (explicit verb route). */
export async function archivePost(client: ApiClient, id: number) {
  const { data } = await client.post<InsightPostDetail>(
    `${BASE}/posts/${id}/archive`,
  );
  return data;
}

export async function listDraftPosts(client: ApiClient) {
  const { data } = await client.get<Paginated<InsightPostListItem>>(
    `${BASE}/posts/drafts`,
    { params: { limit: 100 } },
  );
  return data.data;
}

export async function listPublishedPosts(client: ApiClient) {
  const { data } = await client.get<Paginated<InsightPostListItem>>(
    `${BASE}/posts`,
    { params: { limit: 100 } },
  );
  return data.data;
}

export async function getPostById(client: ApiClient, id: number) {
  const { data } = await client.get<InsightPostDetail>(`${BASE}/posts/by-id/${id}`);
  return data;
}

export async function updatePost(
  client: ApiClient,
  id: number,
  body: InsightPostUpdate,
) {
  const { data } = await client.patch<InsightPostDetail>(`${BASE}/posts/${id}`, body);
  return data;
}

export async function publishPost(client: ApiClient, id: number) {
  const { data } = await client.post<InsightPostDetail>(`${BASE}/posts/${id}/publish`);
  return data;
}

export async function unpublishPost(client: ApiClient, id: number) {
  const { data } = await client.post<InsightPostDetail>(`${BASE}/posts/${id}/unpublish`);
  return data;
}

export async function pinPost(client: ApiClient, id: number) {
  const { data } = await client.post<InsightPostDetail>(`${BASE}/posts/${id}/pin`);
  return data;
}

export async function unpinPost(client: ApiClient, id: number) {
  const { data } = await client.post<InsightPostDetail>(`${BASE}/posts/${id}/unpin`);
  return data;
}

export async function uploadDocx(
  client: ApiClient,
  args: {
    file: File;
    slug: string;
    contentType: string;
    title?: string;
    author?: string;
    /** Article (written) date, ISO. */
    publishedAt?: string;
  },
) {
  const form = new FormData();
  form.append("file", args.file);
  form.append("slug", args.slug);
  form.append("content_type", args.contentType);
  if (args.title) form.append("title", args.title);
  if (args.author) form.append("author", args.author);
  if (args.publishedAt) form.append("published_at", args.publishedAt);
  const { data } = await client.post<InsightPostDetail>(
    `${BASE}/posts/upload-docx`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}
