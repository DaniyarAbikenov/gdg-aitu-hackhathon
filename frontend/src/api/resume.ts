import client from "./client";
import type { ResumeFields } from "@/types/resume";
export interface Improvement {
  id: string;
  section: keyof ResumeFields;
  before: string;
  after: string;
  reason: string;
}
export interface ResumeRecord {
  resume_id: string;
  filename: string;
  title: string;
  description: string;
  lifecycle: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
  status: string;
  fields: ResumeFields;
  revision: number;
  jd_text: string;
  analysis?: { missing_skills: string[] };
}
export function structured(fields: ResumeFields): ResumeFields {
  const result = { ...fields };
  // Older saved records contain text sections. Preserve every character in an editable entry.
  for (const key of ["experience", "education", "projects"] as const) {
    const text = fields[key] as unknown;
    if (typeof text !== "string") continue;
    if (key === "experience")
      result.experience = text
        ? [
            {
              company: "",
              role: "",
              date_from: "",
              date_to: "",
              achievements: [text],
            },
          ]
        : [];
    if (key === "education")
      result.education = text
        ? [{ institution: text, degree: "", year_start: 0, year_end: 0 }]
        : [];
    if (key === "projects")
      result.projects = text
        ? [{ title: "", description: text, tech: [] }]
        : [];
  }
  return result;
}
export async function uploadResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  return (await client.post<ResumeRecord>("/resume/upload", form)).data;
}
export async function getResume(id: string) {
  const { data } = await client.get<ResumeRecord>(`/resume/${id}`);
  return { ...data, fields: structured(data.fields) };
}
export async function listResumes() {
  return (await client.get<ResumeRecord[]>("/resume")).data;
}
export async function saveResumeFields(
  id: string,
  fields: ResumeFields,
  revision: number,
) {
  return (
    await client.post<ResumeRecord>(`/resume/${id}/save`, { fields, revision })
  ).data;
}
export async function improveResume(
  id: string,
  jd_text: string,
  revision: number,
) {
  return (
    await client.post<{ improvements: Improvement[]; provider: string }>(
      `/resume/${id}/adapt`,
      { jd_text, revision },
    )
  ).data;
}
export async function generateResume(id: string, template: string) {
  const { data } = await client.get(`/resume/${id}/pdf`, {
    params: { template },
    responseType: "blob",
  });
  return { pdf_url: URL.createObjectURL(data) };
}
export async function saveVersion(
  id: string,
  fields: ResumeFields,
  revision: number,
  label: string,
  jd_text: string,
) {
  return (
    await client.post(`/resume/${id}/versions`, {
      fields,
      revision,
      label,
      jd_text,
    })
  ).data;
}
