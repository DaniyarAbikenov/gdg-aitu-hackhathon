import { create } from "zustand";

/** The interview the user is working through, for pages opened without an id. */
interface InterviewState {
  sessionId: string;
  setSession: (id: string) => void;
  reset: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  sessionId: "",
  setSession: (id) => set({ sessionId: id }),
  reset: () => set({ sessionId: "" }),
}));
