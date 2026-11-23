"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useApiClient } from "./use-api-client";
import {
  getRegulation,
  getRegulations,
  type RegulationListParams,
} from "@/lib/api/regulations";
import type {
  RegulationDetail,
  RegulationListResponse,
} from "@/lib/types";

export const regulationQueryKeys = {
  all: ["regulations"] as const,
  lists: () => [...regulationQueryKeys.all, "list"] as const,
  list: (params: RegulationListParams) =>
    [...regulationQueryKeys.lists(), params] as const,
  details: () => [...regulationQueryKeys.all, "detail"] as const,
  detail: (id: number | string) =>
    [...regulationQueryKeys.details(), String(id)] as const,
};

export function useRegulations(
  params: RegulationListParams = {},
  options?: Omit<
    UseQueryOptions<RegulationListResponse>,
    "queryKey" | "queryFn"
  >,
) {
  const client = useApiClient();
  return useQuery<RegulationListResponse>({
    queryKey: regulationQueryKeys.list(params),
    queryFn: () => getRegulations(client, params),
    placeholderData: (prev) => prev,
    // Regulations change on workbook loads, not during a session.
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useRegulation(id: number | string | null | undefined) {
  const client = useApiClient();
  return useQuery<RegulationDetail>({
    queryKey: regulationQueryKeys.detail(id ?? ""),
    queryFn: () => getRegulation(client, id as number | string),
    enabled: id != null && id !== "",
    staleTime: 5 * 60 * 1000,
  });
}
