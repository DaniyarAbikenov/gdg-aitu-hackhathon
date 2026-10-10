import type { ResumeRecord } from "@/api/types";

export interface ResumeFields {
  position?: string;
  location?: string;
  certificates?: string;
  languages?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  summary?: string;

  skills?: string[];

  experience?: {
    id?: string;
    company: string;
    role: string;
    date_from: string;
    date_to: string;
    achievements?: string[];
    location?: string;
    responsibilities?: string;
  }[];

  education?: {
    id?: string;
    institution: string;
    degree: string;
    year_start: number;
    year_end: number;
  }[];

  projects?: {
    id?: string;
    title: string;
    description: string;
    tech: string[];
  }[];

  /** Achievements outside one job: competitions, awards, publications. */
  awards?: {
    id?: string;
    title: string;
    detail: string;
    year: number;
  }[];

  interests?: string[];
}

/** A resume whose legacy text sections were normalized into editable entries. */
export type Resume = Omit<ResumeRecord, "fields"> & { fields: ResumeFields };

export interface Improvement {
  id: string;
  section: keyof ResumeFields;
  before: string;
  after: string;
  reason: string;
}

export interface Adaptation {
  improvements: Improvement[];
  provider: string;
}

export interface Assessment {
  job: string;
  improvements: Improvement[];
}

export interface CreatedResume {
  questions: string[];
  resume: ResumeRecord;
}

export interface AppliedProposal {
  fields: ResumeFields;
  revision: number;
}

export type ResumeMetadata = Pick<
  ResumeRecord,
  "title" | "description" | "lifecycle" | "revision"
>;
