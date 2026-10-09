import client from "@/api/client";
import type { AiUsage } from "@/api/types";
import { useQuery } from "@tanstack/react-query";

export const usageKeys = {
  days: (days: number) => ["ai-usage", days] as const,
};

export function useAiUsage(days: number) {
  return useQuery({
    queryKey: usageKeys.days(days),
    queryFn: async () =>
      (await client.get<AiUsage>("/admin/ai-usage", { params: { days } })).data,
  });
}
