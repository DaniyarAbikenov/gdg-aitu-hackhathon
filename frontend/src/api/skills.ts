import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import client from "./client";

export type Skill = { id: string; name: string; description: string };

export const skillKeys = {
  all: ["skills"] as const,
  search: (q: string) => [...skillKeys.all, "search", q] as const,
};

export function useSkillSearch(q: string) {
  return useQuery({
    queryKey: skillKeys.search(q),
    queryFn: async ({ signal }) =>
      (
        await client.get<{ skills: Skill[] }>("/skills", {
          params: { q },
          signal,
        })
      ).data.skills,
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (skill: { name: string; description: string }) =>
      (await client.post<Skill>("/skills", skill)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: skillKeys.all }),
  });
}
