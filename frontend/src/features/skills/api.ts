import client from "@/api/client";
import type { SkillMap } from "@/api/types";
import { useQuery } from "@tanstack/react-query";

export const skillMapKeys = {
  all: ["skill-map"] as const,
};

export function useSkillMap() {
  return useQuery({
    queryKey: skillMapKeys.all,
    queryFn: async () => (await client.get<SkillMap>("/skills/map")).data,
    // Built from profile, vacancies, plans and interviews: reload on every visit.
    staleTime: 0,
  });
}
