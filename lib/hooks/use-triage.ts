"use client";

/**
 * Data hooks for the triage queue — React Query edition.
 *
 * Migrated 2026-08-05 from hand-rolled useState/useEffect hooks; this was the
 * last hand-rolled hook file in the app (every other lib/hooks module already
 * used React Query). What the migration deletes rather than reimplements:
 * the manual request-sequence guards against out-of-order responses (query
 * keys make stale responses unlandable), the page-level refetch chain after
 * every mutation (one `invalidateQueries` on the `triage` key family), and
 * duplicate uncoordinated fetches when multiple components need the same
 * data (RQ dedupes by key).
 *
 * The queue is a write-heavy work surface, so these queries deliberately keep
 * the global 30s staleTime — freshness after a decision comes from mutation
 * invalidation, not from short staleness. `placeholderData: prev` preserves
 * the old hooks' no-skeleton-flash behaviour between a decision and its
 * confirmed result.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useApiClient } from "./use-api-client";
import type { ApiClient } from "@/lib/api/client";
import {
  getMaterialCoverage,
  getTriageEvents,
  getTriageStats,
  getTriageSummary,
  type MaterialCoverage,
  type TriageEventList,
  type TriageListParams,
  type TriageStats,
  type TriageSummary,
} from "@/lib/api/triage";

/**
 * Kept for existing call sites (drawer, promote dialog); the house client
 * hook is the implementation. New code should import useApiClient directly.
 */
export function useTriageApi(): ApiClient {
  return useApiClient();
}

export const triageQueryKeys = {
  /** Invalidate this to refresh every triage surface after a mutation. */
  all: ["triage"] as const,
  events: (params: TriageListParams) =>
    [...triageQueryKeys.all, "events", params] as const,
  summary: () => [...triageQueryKeys.all, "summary"] as const,
  coverage: () => [...triageQueryKeys.all, "coverage"] as const,
  stats: () => [...triageQueryKeys.all, "stats"] as const,
};

export function useTriageSummary(
  options?: Omit<UseQueryOptions<TriageSummary>, "queryKey" | "queryFn">,
) {
  const client = useApiClient();
  return useQuery<TriageSummary>({
    queryKey: triageQueryKeys.summary(),
    queryFn: () => getTriageSummary(client),
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useTriageEvents(
  params: TriageListParams,
  options?: Omit<UseQueryOptions<TriageEventList>, "queryKey" | "queryFn">,
) {
  const client = useApiClient();
  return useQuery<TriageEventList>({
    // Params are part of the key, so filter/page changes fetch their own
    // entry and out-of-order responses can never land on the wrong view —
    // the job the old hand-rolled requestSeq guard existed to do.
    queryKey: triageQueryKeys.events(params),
    queryFn: () => getTriageEvents(client, params),
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useTriageStats(
  options?: Omit<UseQueryOptions<TriageStats>, "queryKey" | "queryFn">,
) {
  const client = useApiClient();
  return useQuery<TriageStats>({
    // Lives in the `triage` key family, so every triage mutation's
    // invalidation refreshes the quality rates along with the queue.
    queryKey: triageQueryKeys.stats(),
    queryFn: () => getTriageStats(client),
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useMaterialCoverage(
  options?: Omit<UseQueryOptions<MaterialCoverage>, "queryKey" | "queryFn">,
) {
  const client = useApiClient();
  return useQuery<MaterialCoverage>({
    queryKey: triageQueryKeys.coverage(),
    queryFn: () => getMaterialCoverage(client),
    placeholderData: (prev) => prev,
    ...options,
  });
}
