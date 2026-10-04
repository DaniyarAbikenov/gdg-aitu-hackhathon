import client from "./client";

// ======================================
// ✅ Типы ответов от сервера (новая логика)
// ======================================

export interface StartInterviewResponse {
    session_id: string;
    question: string;
    total_questions: number;
}

export interface AnswerInterviewResponse {
    finished: boolean;
    feedback: string;
    follow_up: string | null;
    next_question: string | null;
}

// ======================================
// ✅ Методы API
// ======================================

export async function startInterview(payload: {
    company_description: string;
    job_description: string;
    tech_stack: string;
    style: string;
}): Promise<StartInterviewResponse> {
    const r = await client.post("/interview/start", payload);
    return r.data;
}

export async function answerInterview(
    sessionId: string,
    answer: string
): Promise<AnswerInterviewResponse> {
    const r = await client.post(`/interview/${sessionId}/answer`, { answer });
    return r.data;
}
export interface InterviewSummaryResult {
    correct: number;
    partial: number;
    wrong: number;
    summary: {
        summary: string;
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
        estimated_level: string;
    };
}

export async function getInterviewSummary(
    sessionId: string
): Promise<InterviewSummaryResult> {
    const { data } = await client.post(`/interview/${sessionId}/summary`);
    return data;
}
