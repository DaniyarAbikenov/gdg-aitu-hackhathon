import { postJob } from "@/api/jobs";
import client from "@/api/client";
import type {
  ApplicationItem,
  ApplicationPayload,
  CoverLetterDraft,
  CompanyPayload,
  Funnel,
  GenericRecord,
  RejectionResult,
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
  funnel: ["applications-funnel"] as const,
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
  const keys = [
    applicationKeys.all,
    applicationKeys.funnel,
    companyKeys.all,
    targetKeys.all,
  ];
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

export function useFunnel() {
  return useQuery({
    queryKey: applicationKeys.funnel,
    queryFn: async () =>
      (
        await client.get<Funnel>("/applications/funnel", {
          params: { offset: -new Date().getTimezoneOffset() },
        })
      ).data,
    // Practice and learning also count as effort: reload on every visit.
    staleTime: 0,
  });
}

export type RejectionAnswers = {
  revision: number;
  stage: "applied" | "interview";
  reason: RejectionResult["rejection"]["reason"];
  topics: string[];
  feedback: string;
};

export function useReviewRejection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...answers }: RejectionAnswers & { id: string }) =>
      (
        await client.put<RejectionResult>(
          `/applications/${id}/rejection`,
          answers,
        )
      ).data,
    onSuccess: () =>
      invalidateCatalog(queryClient, [
        applicationKeys.all,
        applicationKeys.funnel,
      ]),
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

export function useCoverLetter() {
  return useMutation({
    mutationFn: (id: string) =>
      postJob<CoverLetterDraft>(`/applications/${id}/cover-letter`, {
        language: i18n.language === "kz" ? "kk" : i18n.language,
      }),
  });
}
