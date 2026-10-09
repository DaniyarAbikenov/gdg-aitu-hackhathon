import client from "@/api/client";
import type { ArticlePayload } from "@/api/types";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { KnowledgeArticle } from "./types";

export const knowledgeKeys = {
  all: ["knowledge"] as const,
  published: (language: string) =>
    [...knowledgeKeys.all, "published", language] as const,
  admin: () => [...knowledgeKeys.all, "admin"] as const,
};

export function usePublishedArticles(language: string) {
  return useQuery({
    queryKey: knowledgeKeys.published(language),
    queryFn: async () =>
      (
        await client.get<KnowledgeArticle[]>("/knowledge", {
          params: { language },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useAdminArticles() {
  return useQuery({
    queryKey: knowledgeKeys.admin(),
    queryFn: async () =>
      (await client.get<KnowledgeArticle[]>("/admin/knowledge")).data,
  });
}

export function useSaveArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Omit<ArticlePayload, "language"> & { language: string };
    }) =>
      id
        ? (
            await client.put<KnowledgeArticle>(
              `/admin/knowledge/${id}`,
              payload,
            )
          ).data
        : (await client.post<KnowledgeArticle>("/admin/knowledge", payload))
            .data,
    onSuccess: (article) => {
      queryClient.setQueryData<KnowledgeArticle[]>(
        knowledgeKeys.admin(),
        (articles) => [
          article,
          ...(articles ?? []).filter((a) => a.id !== article.id),
        ],
      );
      return queryClient.invalidateQueries({
        queryKey: knowledgeKeys.all,
        predicate: (query) => query.queryKey[1] === "published",
      });
    },
  });
}
