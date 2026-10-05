import { tr } from "@/i18n/copy";
import client from "./client";
import i18n from "@/i18n/config";
export interface InterviewRecord {
  id: string;
  revision: number;
  question: string | null;
  finished: boolean;
  total_questions: number;
  score: number | null;
  created_at: string;
  context: {
    job_description: string;
    company_description: string;
    company_name?: string;
    vacancy_title?: string;
    mode?: "text" | "voice";
    tech_stack: string;
  };
  transcript?: { id: string; role: "user" | "assistant"; text: string }[];
  answers: {
    question: string;
    answer: string;
    feedback: string;
    score: number;
    strengths: string[];
    improvements: string[];
    reference_answer: string;
  }[];
}
export async function startInterview(payload: {
  company_description: string;
  job_description: string;
  tech_stack: string;
  style: string;
}) {
  const { data } = await client.post<InterviewRecord>("/interview/start", {
    ...payload,
    language: i18n.language === "kz" ? "kk" : i18n.language,
  });
  return { ...data, session_id: data.id };
}
export async function getInterview(id: string) {
  return (await client.get<InterviewRecord>(`/interview/${id}`)).data;
}
export async function answerInterview(
  id: string,
  answer: string,
  revision: number,
) {
  return (
    await client.post<InterviewRecord>(`/interview/${id}/answer`, {
      answer,
      revision,
    })
  ).data;
}
export async function getInterviewSummary(id: string) {
  const record = await getInterview(id);
  return {
    correct: record.answers.filter((a) => a.score >= 70).length,
    partial: record.answers.filter((a) => a.score >= 40 && a.score < 70).length,
    wrong: record.answers.filter((a) => a.score < 40).length,
    summary: {
      summary: record.answers.map((a) => a.feedback).join("\n\n"),
      strengths: [...new Set(record.answers.flatMap((a) => a.strengths))],
      weaknesses: [...new Set(record.answers.flatMap((a) => a.improvements))],
      recommendations: record.answers.map((a) => a.reference_answer),
      estimated_level: tr("dynamic.level", { score: record.score ?? "—" }),
    },
  };
}
