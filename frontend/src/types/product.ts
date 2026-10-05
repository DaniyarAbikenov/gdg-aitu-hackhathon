import type { ResumeFields } from "./resume";
export interface OverviewData {
  goal: string;
  resumes: number;
  reviewed_resumes: number;
  active_resumes: number;
  archived_resumes: number;
  resume_versions: number;
  completed_modules: number;
  total_modules: number;
  interviews_completed: number;
  average_score: number | null;
  skill_gaps: { name: string; mentions: number }[];
  companies: string[];
  week: {
    current: number;
    previous: number;
    learning_current: number;
    learning_previous: number;
  };
  activity: { date: string; count: number }[];
  xp: number;
  level: number;
  level_progress: number;
  streak: number;
  tracking_started: string | null;
}
export interface TargetRecord {
  id: string;
  data: {
    name: string;
    description: string;
    company_id?: string;
    skills?: string[];
  };
}
export interface SnapshotRecord {
  id: string;
  created_at: string;
  data: {
    label: string;
    fields: ResumeFields;
    before: ResumeFields;
    jd_text: string;
  };
}
export interface VoiceEvent {
  type: string;
  transcript?: string;
  item_id?: string;
  response_id?: string;
  event_id?: string;
}
export interface ApplicationFields {
  location: string;
  employment: string;
  salary: string;
  requirements: string[];
  responsibilities: string[];
  name: string;
  description: string;
  company_name: string;
  company_description: string;
  company_id: string | null;
  skills: string[];
  status:
    | "saved"
    | "preparing"
    | "applied"
    | "interview"
    | "offer"
    | "rejected"
    | "archived";
  source_url: string | null;
  resume_id: string | null;
  notes: string;
  next_action: string;
  follow_up: string | null;
}
export interface ApplicationRecord {
  id: string;
  revision: number;
  created_at: string;
  data: ApplicationFields;
  next_step: string;
  next_step_key?: string;
  resume_title: string | null;
  interviews: {
    id: string;
    finished: boolean;
    mode: string;
    score: number | null;
  }[];
  plans: { id: string; goal: string }[];
}
