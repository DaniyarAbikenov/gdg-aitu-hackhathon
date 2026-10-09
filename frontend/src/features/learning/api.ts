import { postJob } from "@/api/jobs";
import client from "@/api/client";
import type { PlanCreate, PlanRecord } from "@/api/types";
import { invalidateCatalog } from "@/features/applications/api";
import { invalidateSummaries } from "@/features/dashboard/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const planKeys = {
  all: ["plans"] as const,
};

export function usePlans() {
  return useQuery({
    queryKey: planKeys.all,
    queryFn: async () => (await client.get<PlanRecord[]>("/plan")).data,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<PlanCreate> & Pick<PlanCreate, "goal">,
    ) => postJob<PlanRecord>("/plan", payload),
    onSuccess: (plan) => {
      queryClient.setQueryData<PlanRecord[]>(planKeys.all, (plans) =>
        plans ? [...plans, plan] : plans,
      );
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: planKeys.all }),
        invalidateCatalog(queryClient),
      ]);
    },
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      moduleId,
      ...update
    }: {
      planId: string;
      moduleId: string;
      revision: number;
      completed: boolean;
      evidence: string;
    }) =>
      (
        await client.post<PlanRecord>(
          `/plan/${planId}/modules/${moduleId}`,
          update,
        )
      ).data,
    onSuccess: (plan) => {
      queryClient.setQueryData<PlanRecord[]>(planKeys.all, (plans) =>
        plans?.map((p) => (p.id === plan.id ? plan : p)),
      );
      return invalidateSummaries(queryClient);
    },
  });
}
