export interface ResumeFields {
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
