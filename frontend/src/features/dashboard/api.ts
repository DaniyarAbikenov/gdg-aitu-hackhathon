import client from "@/api/client";
import type { Overview, Preferences } from "@/api/types";
import { progressKeys } from "@/features/progress/api";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const overviewKeys = {
  all: ["overview"] as const,
};

export const preferenceKeys = {
  all: ["preferences"] as const,
};

/** Overview and progress aggregate every feature; mark them stale after any write. */
export function invalidateSummaries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: overviewKeys.all,
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: progressKeys.all,
      refetchType: "none",
    }),
  ]);
}

export function useOverview() {
  return useQuery({
    queryKey: overviewKeys.all,
    queryFn: async () =>
      (
        await client.get<Overview>("/overview", {
          params: { offset: -new Date().getTimezoneOffset() },
        })
      ).data,
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: async () => (await client.get<Preferences>("/preferences")).data,
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { widgets: string[]; revision: number }) =>
      (await client.put<Preferences>("/preferences", payload)).data,
    onSuccess: (record) => queryClient.setQueryData(preferenceKeys.all, record),
  });
}
