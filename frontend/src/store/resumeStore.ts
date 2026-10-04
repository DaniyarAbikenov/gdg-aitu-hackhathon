import { create } from "zustand";
import { ResumeFields } from "@/types/resume";

interface ResumeState {
    resumeId: string | null;
    fields: ResumeFields | null;

    jdText: string;
    improvements: any[];

    setResumeId: (id: string) => void;
    setFields: (fields: ResumeFields) => void;

    setJdText: (text: string) => void;
    setImprovements: (items: any[]) => void;

    updateField: (key: keyof ResumeFields, value: any) => void;
}

export const useResumeStore = create<ResumeState>((set) => ({
    resumeId: null,
    fields: null,

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
}));
