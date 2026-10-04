import { create } from "zustand";

/* ---------------------------------------------
   Типы
---------------------------------------------- */

export type MessageRole = "user" | "interviewer";

export interface Message {
  role: MessageRole;
  text: string;
}

export interface SummaryBlock {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  estimated_level: string;
}

export interface InterviewSummary {
  correct: number;
  partial: number;
  wrong: number;
  summary: SummaryBlock;
}

interface InterviewState {
  /* Состояние */
  revision: number;
  hydrate: (record: import("@/api/interview").InterviewRecord) => void;
  sessionId: string;
  currentQuestion: string;
  totalQuestions: number;
  feedback: string;
  followUp: string | null;
  finished: boolean;
  messages: Message[];
  summary: InterviewSummary | null;

  /* Методы */
  reset: () => void;
  setSession: (id: string) => void;
  setInitialQuestion: (q: string, total: number) => void;
  addMessage: (msg: Message) => void;
  setResult: (args: {
    finished: boolean;
    feedback: string;
    followUp: string | null;
    nextQuestion: string | null;
  }) => void;
  setSummary: (summary: InterviewSummary) => void;
}

/* ---------------------------------------------
   Store
---------------------------------------------- */

export const useInterviewStore = create<InterviewState>((set) => ({
  /* --------------------------- */
  /* Начальные значения          */
  /* --------------------------- */

  revision: 0,
  hydrate: (record) =>
    set({
      sessionId: record.id,
      revision: record.revision,
      currentQuestion: record.question || "",
      totalQuestions: record.total_questions,
      finished: record.finished,
      messages: [
        ...record.answers.flatMap((a) => [
          { role: "interviewer" as const, text: a.question },
          { role: "user" as const, text: a.answer },
          { role: "interviewer" as const, text: a.feedback },
        ]),
        ...(record.question
          ? [{ role: "interviewer" as const, text: record.question }]
          : []),
      ],
    }),
  sessionId: "",
  currentQuestion: "",
  totalQuestions: 0,
  feedback: "",
  followUp: null,
  finished: false,
  messages: [],
  summary: null,

  /* --------------------------- */
  /* Методы                      */
  /* --------------------------- */

  reset: () =>
    set({
      revision: 0,
      sessionId: "",
      currentQuestion: "",
      totalQuestions: 0,
      feedback: "",
      followUp: null,
      finished: false,
      messages: [],
      summary: null,
    }),

  setSession: (id) => set({ sessionId: id }),

  setInitialQuestion: (q, total) =>
    set({
      currentQuestion: q,
      totalQuestions: total,
      feedback: "",
      followUp: null,
      finished: false,
      messages: [{ role: "interviewer", text: q }],
      summary: null,
    }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  setResult: ({ finished, feedback, followUp, nextQuestion }) =>
    set((state) => {
      const newMessages: Message[] = [
        ...state.messages,
        { role: "interviewer", text: feedback },
      ];

      if (followUp) {
        newMessages.push({ role: "interviewer", text: followUp });
      } else if (nextQuestion) {
        newMessages.push({ role: "interviewer", text: nextQuestion });
      }

      return {
        finished,
        feedback,
        followUp,
        currentQuestion: followUp ?? nextQuestion ?? state.currentQuestion,

        messages: newMessages,
      };
    }),

  setSummary: (summary) => set({ summary }),
}));
