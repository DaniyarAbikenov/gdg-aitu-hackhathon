import type { ApplicationFields, ApplicationPayload } from "@/api/types";
import type { ApplicationDraft } from "./types";

export const emptyApplication: ApplicationDraft = {
  location: "",
  employment: "",
  salary: "",
  requirements: [],
  responsibilities: [],
  name: "",
  company_name: "",
  company_description: "",
  description: "",
  skills: [],
  status: "saved",
  source_url: "",
  resume_id: "",
  company_id: "",
  notes: "",
  next_action: "",
  follow_up: "",
};

/**
 * Only editable fields cross the boundary; server-derived context stays server-side.
 * The cover letter is sent only when given, so other edits never overwrite it.
 */
export function applicationPayload(
  draft: ApplicationDraft | ApplicationFields,
  revision: number,
  changes: Partial<ApplicationPayload> = {},
): ApplicationPayload {
  const data = { ...emptyApplication, ...draft, ...changes };
  const editable = Object.fromEntries(
    Object.keys(emptyApplication).map((k) => [k, data[k as keyof typeof data]]),
  );
  return {
    ...editable,
    ...(changes.cover_letter !== undefined
      ? { cover_letter: changes.cover_letter }
      : {}),
    revision,
    source_url: data.source_url || null,
    resume_id: data.resume_id || null,
    company_id: data.company_id || null,
    follow_up: data.follow_up || null,
  } as ApplicationPayload;
}
