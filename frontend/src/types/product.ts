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
