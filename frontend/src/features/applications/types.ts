import type {
  ApplicationPayload,
  CompanyPayload,
  CompanyResearch,
} from "@/api/types";

/** Vacancy form state: list fields are always present while editing. */
export type ApplicationDraft = Omit<
  ApplicationPayload,
  "revision" | "requirements" | "responsibilities" | "skills"
> & {
  requirements: string[];
  responsibilities: string[];
  skills: string[];
};

export interface VacancyImportResult {
  draft: Partial<ApplicationDraft>;
  source_url: string | null;
  provider: string;
}

// Company and target endpoints return generic records; these describe their data.
export type Assignment = Required<
  NonNullable<CompanyPayload["assignments"]>[number]
>;

export type CompanyData = {
  name: string;
  description: string;
  website: string | null;
  location: string;
  skills: string[];
  hiring_process: string;
  notes: string;
  assignments: Assignment[];
  archived: boolean;
};

export type CompanyRecord = {
  id: string;
  revision: number;
  /** `research` is made by the server from the company website and is never sent back. */
  data: CompanyData & { research?: CompanyResearch };
  vacancy_ids?: string[];
};

export interface TargetRecord {
  id: string;
  data: {
    name: string;
    description: string;
    company_id?: string;
    skills?: string[];
  };
}
