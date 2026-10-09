import { postJob } from "@/api/jobs";
import client from "@/api/client";
import type {
  ApplicationItem,
  ApplicationPayload,
  CompanyPayload,
  GenericRecord,
  TargetPayload,
} from "@/api/types";
import { invalidateSummaries } from "@/features/dashboard/api";
import i18n from "@/i18n/config";
import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { CompanyRecord, TargetRecord, VacancyImportResult } from "./types";

type TargetKind = "company" | "vacancy";

export const applicationKeys = {
  all: ["applications"] as const,
};

export const companyKeys = {
  all: ["companies"] as const,
};

export const targetKeys = {
  all: ["targets"] as const,
  kind: (kind: TargetKind) => [...targetKeys.all, kind] as const,
};

/** Vacancies, companies and targets reference each other; refresh `active` and mark the rest stale. */
export function invalidateCatalog(
  queryClient: QueryClient,
  active: QueryKey[] = [],
) {
  const keys = [applicationKeys.all, companyKeys.all, targetKeys.all];
  return Promise.all([
    ...keys.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
        refetchType: active.includes(queryKey) ? "active" : "none",
      }),
    ),
    invalidateSummaries(queryClient),
  ]);
}

export function useApplications({ enabled = true } = {}) {
  return useQuery({
    queryKey: applicationKeys.all,
    queryFn: async () =>
      (await client.get<ApplicationItem[]>("/applications")).data,
    enabled,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: companyKeys.all,
    queryFn: async () => (await client.get<CompanyRecord[]>("/companies")).data,
  });
}

export function useTargets(kind: TargetKind) {
  return useQuery({
    queryKey: targetKeys.kind(kind),
    queryFn: async () =>
      (await client.get<TargetRecord[]>(`/targets/${kind}`)).data,
  });
}

export function useSaveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: ApplicationPayload;
    }) =>
      id
        ? (await client.put<GenericRecord>(`/applications/${id}`, payload)).data
        : (await client.post<GenericRecord>("/applications", payload)).data,
    onSuccess: () =>
      invalidateCatalog(queryClient, [applicationKeys.all, companyKeys.all]),
  });
}

export function useSaveCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string;
      payload: CompanyPayload;
    }) =>
      id
        ? (await client.put<GenericRecord>(`/companies/${id}`, payload)).data
        : (await client.post<GenericRecord>("/companies", payload)).data,
    onSuccess: () => invalidateCatalog(queryClient, [companyKeys.all]),
  });
}

export function useCreateTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      kind,
      ...payload
    }: Partial<TargetPayload> &
      Pick<TargetPayload, "name" | "description"> & { kind: TargetKind }) =>
      (await client.post<TargetRecord>(`/targets/${kind}`, payload)).data,
    onSuccess: () => invalidateCatalog(queryClient, [targetKeys.all]),
  });
}

export function useImportVacancy() {
  return useMutation({
    mutationFn: async ({ url, text }: { url: string | null; text: string }) =>
      postJob<VacancyImportResult>("/applications/import", {
        url,
        text,
        language: i18n.language === "kz" ? "kk" : i18n.language,
      }),
  });
}
