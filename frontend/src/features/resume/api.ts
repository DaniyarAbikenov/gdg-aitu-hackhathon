import client from "@/api/client";
import type { ResumeRecord, VersionRecord } from "@/api/types";
import { invalidateSummaries } from "@/features/dashboard/api";
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  Adaptation,
  AppliedProposal,
  Assessment,
  CreatedResume,
  Resume,
  ResumeFields,
  ResumeMetadata,
} from "./types";

export function structured(
  fields: Partial<Record<keyof ResumeFields, unknown>>,
) {
  // Older saved records contain text sections. Preserve every character in an editable entry.
  const result = { ...fields } as ResumeFields;
  for (const key of ["experience", "education", "projects"] as const) {
    const text = fields[key];
    if (typeof text !== "string") continue;
    if (key === "experience")
      result.experience = text
        ? [
            {
              company: "",
              role: "",
              date_from: "",
              date_to: "",
              achievements: [text],
            },
          ]
        : [];
    if (key === "education")
      result.education = text
        ? [{ institution: text, degree: "", year_start: 0, year_end: 0 }]
        : [];
    if (key === "projects")
      result.projects = text
        ? [{ title: "", description: text, tech: [] }]
        : [];
  }
  return result;
}

const normalized = (record: ResumeRecord): Resume => ({
  ...record,
  fields: structured(record.fields),
});

export const resumeKeys = {
  all: ["resumes"] as const,
  list: () => [...resumeKeys.all, "list"] as const,
  detail: (id: string) => [...resumeKeys.all, "detail", id] as const,
  assessment: (id: string) => [...resumeKeys.all, "assessment", id] as const,
  versions: (id: string) => [...resumeKeys.all, "versions", id] as const,
};

// Edits are guarded by revision, so a page always loads the current record on mount.
export const resumeQuery = (id: string) =>
  queryOptions({
    queryKey: resumeKeys.detail(id),
    queryFn: async () =>
      normalized((await client.get<ResumeRecord>(`/resume/${id}`)).data),
    staleTime: 0,
  });

/** Refreshes resume data; `current` names a detail already updated from the response. */
function invalidateResumes(queryClient: QueryClient, current?: string) {
  const fresh = current ? resumeKeys.detail(current).join("/") : null;
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: resumeKeys.all,
      predicate: (query) => query.queryKey.join("/") !== fresh,
    }),
    invalidateSummaries(queryClient),
  ]);
}

export function useResumes() {
  return useQuery({
    queryKey: resumeKeys.list(),
    queryFn: async () => (await client.get<ResumeRecord[]>("/resume")).data,
  });
}

export function useResume(id: string) {
  return useQuery(resumeQuery(id));
}

export function useAssessment(id: string) {
  return useQuery({
    queryKey: resumeKeys.assessment(id),
    queryFn: async () =>
      (await client.get<Assessment | null>(`/resume/${id}/assessment`)).data,
    staleTime: 0,
  });
}

export function useResumeVersions(id: string) {
  return useQuery({
    queryKey: resumeKeys.versions(id),
    queryFn: async () =>
      (await client.get<VersionRecord[]>(`/resume/${id}/versions`)).data,
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await client.post<ResumeRecord>("/resume/upload", form)).data;
    },
    onSuccess: () => invalidateResumes(queryClient),
  });
}

export function useCreateResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      vacancy_id: string | null;
      position: string;
      job: string;
      facts: string;
      sections: string[];
      use_ai: boolean;
    }) => (await client.post<CreatedResume>("/resume/create", payload)).data,
    onSuccess: () => invalidateResumes(queryClient),
  });
}

export function useSaveResumeFields() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fields,
      revision,
    }: {
      id: string;
      fields: ResumeFields;
      revision: number;
    }) =>
      (
        await client.post<ResumeRecord>(`/resume/${id}/save`, {
          fields,
          revision,
        })
      ).data,
    onSuccess: (record) => {
      queryClient.setQueryData(
        resumeKeys.detail(record.resume_id),
        normalized(record),
      );
      return invalidateResumes(queryClient, record.resume_id);
    },
  });
}

export function useAdaptResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      jd_text,
      revision,
    }: {
      id: string;
      jd_text: string;
      revision: number;
    }) =>
      (
        await client.post<Adaptation>(`/resume/${id}/adapt`, {
          jd_text,
          revision,
        })
      ).data,
    onSuccess: () => invalidateResumes(queryClient),
  });
}

export function useApplyProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      revision,
      proposal_id,
    }: {
      id: string;
      revision: number;
      proposal_id: string;
    }) =>
      (
        await client.post<AppliedProposal>(`/resume/${id}/apply`, {
          revision,
          proposal_id,
        })
      ).data,
    onSuccess: () => invalidateResumes(queryClient),
  });
}

export function useUpdateResumeMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...metadata }: ResumeMetadata & { id: string }) =>
      (await client.patch<ResumeRecord>(`/resume/${id}/metadata`, metadata))
        .data,
    onSuccess: (record) => {
      queryClient.setQueryData<ResumeRecord[]>(resumeKeys.list(), (list) =>
        list?.map((r) => (r.resume_id === record.resume_id ? record : r)),
      );
      return invalidateResumes(queryClient);
    },
  });
}

export function useSaveVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...version
    }: {
      id: string;
      fields: ResumeFields;
      revision: number;
      label: string;
      jd_text: string;
    }) =>
      (await client.post<VersionRecord>(`/resume/${id}/versions`, version))
        .data,
    onSuccess: () => invalidateResumes(queryClient),
  });
}

export function useRestoreVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      versionId,
      revision,
    }: {
      versionId: string;
      revision: number;
    }) =>
      (
        await client.post<ResumeRecord>(`/versions/${versionId}/restore`, {
          revision,
        })
      ).data,
    onSuccess: () => invalidateResumes(queryClient),
  });
}

export function useGenerateResumePdf() {
  return useMutation({
    mutationFn: async ({ id, template }: { id: string; template: string }) => {
      const { data } = await client.get<Blob>(`/resume/${id}/pdf`, {
        params: { template },
        responseType: "blob",
      });
      return { pdf_url: URL.createObjectURL(data) };
    },
  });
}
