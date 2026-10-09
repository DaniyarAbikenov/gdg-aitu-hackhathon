import client from "@/api/client";
import type { GenericRecord, Progress } from "@/api/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const progressKeys = {
  all: ["progress"] as const,
};

export function useProgress() {
  return useQuery({
    queryKey: progressKeys.all,
    queryFn: async () => (await client.get<Progress>("/progress")).data,
  });
}

export function useClaimReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) =>
      (await client.post<GenericRecord>(`/progress/rewards/${key}`)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: progressKeys.all }),
  });
}
