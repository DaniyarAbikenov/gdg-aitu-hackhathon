import { postJob } from "@/api/jobs";
import { tr } from "@/i18n/copy";
import client from "@/api/client";
import i18n from "@/i18n/config";
import type {
  InterviewStartRequest,
  InterviewView,
  TranscriptTurn,
} from "@/api/types";
import { invalidateCatalog } from "@/features/applications/api";
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { InterviewSummary, VoiceAnswer } from "./types";

export const interviewKeys = {
  all: ["interviews"] as const,
  list: () => [...interviewKeys.all, "list"] as const,
  detail: (id: string) => [...interviewKeys.all, "detail", id] as const,
};

// Answers are guarded by revision, so a page always loads the current record on mount.
export const interviewQuery = (id: string) =>
  queryOptions({
    queryKey: interviewKeys.detail(id),
    queryFn: async () =>
      (await client.get<InterviewView>(`/interview/${id}`)).data,
    staleTime: 0,
  });

/** Stores an updated interview and marks everything derived from it stale. */
function updated(queryClient: QueryClient, record: InterviewView) {
  queryClient.setQueryData(interviewKeys.detail(record.id), record);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: interviewKeys.list() }),
    invalidateCatalog(queryClient),
  ]);
}

export function useInterviews() {
  return useQuery({
    queryKey: interviewKeys.list(),
    queryFn: async () => (await client.get<InterviewView[]>("/interview")).data,
  });
}

export function useInterview(id: string) {
  return useQuery({ ...interviewQuery(id), enabled: !!id });
}

export function summarize(record: InterviewView): InterviewSummary {
  return {
    correct: record.answers.filter((a) => a.score >= 70).length,
    partial: record.answers.filter((a) => a.score >= 40 && a.score < 70).length,
    wrong: record.answers.filter((a) => a.score < 40).length,
    summary: {
      summary: record.answers.map((a) => a.feedback).join("\n\n"),
      strengths: [...new Set(record.answers.flatMap((a) => a.strengths ?? []))],
      weaknesses: [
        ...new Set(record.answers.flatMap((a) => a.improvements ?? [])),
      ],
      recommendations: record.answers.map((a) => a.reference_answer),
      estimated_level: tr("dynamic.level", { score: record.score ?? "—" }),
    },
  };
}

export function useStartInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<InterviewStartRequest, "language">) =>
      postJob<InterviewView>("/interview/start", {
        ...payload,
        language: i18n.language === "kz" ? "kk" : i18n.language,
      }),
    onSuccess: (record) => updated(queryClient, record),
  });
}

export function useAnswerInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      answer,
      revision,
    }: {
      id: string;
      answer: string;
      revision: number;
    }) =>
      postJob<InterviewView>(`/interview/${id}/answer`, { answer, revision }),
    onSuccess: (record) => updated(queryClient, record),
  });
}

export function useSaveTranscript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...transcript
    }: {
      id: string;
      revision: number;
      turns: TranscriptTurn[];
      finish: boolean;
    }) =>
      (
        await client.post<InterviewView>(
          `/interview/${id}/voice/transcript`,
          transcript,
        )
      ).data,
    onSuccess: (record) => updated(queryClient, record),
  });
}

export function useConnectVoice() {
  return useMutation({
    mutationFn: async ({
      id,
      ...offer
    }: {
      id: string;
      sdp: string | undefined;
      revision: number;
    }) =>
      (await client.post<VoiceAnswer>(`/interview/${id}/voice/connect`, offer))
        .data,
  });
}
