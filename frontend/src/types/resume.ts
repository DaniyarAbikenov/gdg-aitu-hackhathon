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
    company: string;
    role: string;
    date_from: string;
    date_to: string;
    achievements?: string[];
    location?: string;
    responsibilities?: string;
  }[];

  education?: {
    institution: string;
    degree: string;
    year_start: number;
    year_end: number;
  }[];

  projects?: {
    title: string;
    description: string;
    tech: string[];
  }[];
}
