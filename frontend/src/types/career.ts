import type { ResumeFields } from "./resume";
export interface Profile extends ResumeFields {
  revision: number;
  full_name: string;
  email: string;
  career_goal: string;
  desired_position: string;
  skills: string[];
  language: "en" | "ru" | "kk";
  audio_mode: boolean;
  extra: { languages: string[]; normalized_skills: string[] };
}
export interface Module {
  id: string;
  title: string;
  goals: string[];
  exercise: string;
  hours: number;
  resource_topic: string;
  completed: boolean;
  evidence: string;
}
export interface PlanRecord {
  id: string;
  revision: number;
  data: { goal: string; explanation: string; modules: Module[] };
}
export interface ProgressRecord {
  completed_modules: number;
  total_modules: number;
  average_score: number | null;
  resume_versions: number;
  rewards: {
    key: string;
    title: string;
    available: boolean;
    claimed: boolean;
  }[];
}
export interface VersionRecord {
  id: string;
  date: string;
  tag: string;
  description: string;
  data: {
    label: string;
    fields: ResumeFields;
    before: ResumeFields;
    jd_text: string;
  };
}
