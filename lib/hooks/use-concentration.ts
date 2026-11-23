"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useApiClient } from "./use-api-client";
import {
  getConcentrationDetail,
  getConcentrationOverview,
  type ConcentrationOverview,
  type MaterialConcentrationDetail,
} from "@/lib/api/concentration";

export const concentrationQueryKeys = {
  all: ["concentration"] as const,
  overview: (asOf?: string) =>
    [...concentrationQueryKeys.all, "overview", asOf ?? "today"] as const,
  detail: (materialId: number, asOf?: string) =>
    [...concentrationQueryKeys.all, "detail", materialId, asOf ?? "today"] as const,
};

/** Concentration inputs change on data loads (MCS releases, benchmark
 *  workbook loads), not during a browsing session — so cache generously and
 *  navigation back to these pages renders instantly instead of refetching. */
const CONCENTRATION_STALE_MS = 10 * 60 * 1000;

export function useConcentrationOverview(
  asOf?: string,
  options?: Omit<UseQueryOptions<ConcentrationOverview>, "queryKey" | "queryFn">,
) {
  const client = useApiClient();
  return useQuery<ConcentrationOverview>({
    queryKey: concentrationQueryKeys.overview(asOf),
    queryFn: () => getConcentrationOverview(client, asOf),
    placeholderData: (prev) => prev,
    staleTime: CONCENTRATION_STALE_MS,
    ...options,
  });
}

export function useConcentrationDetail(
  materialId: number,
  asOf?: string,
  options?: Omit<UseQueryOptions<MaterialConcentrationDetail>, "queryKey" | "queryFn">,
) {
  const client = useApiClient();
  return useQuery<MaterialConcentrationDetail>({
    queryKey: concentrationQueryKeys.detail(materialId, asOf),
    queryFn: () => getConcentrationDetail(client, materialId, asOf),
    staleTime: CONCENTRATION_STALE_MS,
    ...options,
  });
}
