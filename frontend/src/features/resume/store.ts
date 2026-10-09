import { create } from "zustand";
import type { Improvement, ResumeFields } from "./types";

/** Draft of the resume being edited, shared by the edit → improvements steps. */
interface ResumeState {
  resumeId: string | null;
  fields: ResumeFields | null;

  revision: number;
  setRevision: (revision: number) => void;
  jdText: string;
  improvements: Improvement[];

  setResumeId: (id: string) => void;
  setFields: (fields: ResumeFields) => void;

  setJdText: (text: string) => void;
  setImprovements: (items: Improvement[]) => void;

  updateField: (
    key: keyof ResumeFields,
    value: ResumeFields[keyof ResumeFields],
  ) => void;
  reset: () => void;
}

export const useResumeStore = create<ResumeState>((set) => ({
  resumeId: null,
  fields: null,

  revision: 0,
  setRevision: (revision) => set({ revision }),
  jdText: "",
  improvements: [],

  setResumeId: (id) => set({ resumeId: id }),
  setFields: (fields) => set({ fields }),

  setJdText: (text) => set({ jdText: text }),
  setImprovements: (items) => set({ improvements: items }),

  updateField: (key, value) =>
    set((state) => ({
      fields: {
        ...(state.fields || {}),
        [key]: value,
      },
    })),
  reset: () =>
    set({
      resumeId: null,
      fields: null,
      revision: 0,
      jdText: "",
      improvements: [],
    }),
}));
