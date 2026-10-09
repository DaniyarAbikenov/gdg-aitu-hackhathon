import client from "@/api/client";
import type { ProfileRecord, Schemas } from "@/api/types";
import { invalidateSummaries } from "@/features/dashboard/api";
import type { ResumeFields } from "@/features/resume/types";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export interface UpdateProfileRequest extends ResumeFields {
  full_name?: string;
  email?: string;
  desired_position?: string;
  career_goal?: string;
  skills?: string[];
  language?: string;
  audio_mode?: boolean;
  extra?: { languages?: string[]; normalized_skills?: string[] };
}

export interface ProfileImport {
  fields: Schemas["ResumeFields"];
  filename: string;
  provider: string;
}

export const profileKeys = {
  all: ["profile"] as const,
};

// Saves are guarded by revision, so the profile is reloaded whenever a page mounts.
export const profileQuery = queryOptions({
  queryKey: profileKeys.all,
  queryFn: async () => (await client.get<ProfileRecord>("/user/profile")).data,
  staleTime: 0,
});

export function useProfile() {
  return useQuery(profileQuery);
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patch,
      revision,
    }: {
      patch: UpdateProfileRequest;
      revision?: number;
    }) => {
      const { data: current } =
        await client.get<ProfileRecord>("/user/profile");
      return (
        await client.post<ProfileRecord>("/user/profile/update", {
          profile: { ...current.data, ...patch },
          revision: revision ?? current.revision,
        })
      ).data;
    },
    onSuccess: (record) => {
      queryClient.setQueryData(profileKeys.all, record);
      void invalidateSummaries(queryClient);
    },
  });
}

export function useImportProfile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await client.post<ProfileImport>("/user/profile/import", form))
        .data;
    },
  });
}
