import client from "./client";
import type { ResumeFields } from "@/types/resume";
export interface UpdateProfileRequest extends ResumeFields {
  full_name?: string;
  email?: string;
  desired_position?: string;
  career_goal?: string;
  skills?: string[];
  language?: string;
  audio_mode?: boolean;
  extra?: { languages?: string[]; normalized_skills?: string[] };
}
export async function getUserProfile() {
  const { data } = await client.get("/user/profile");
  return { ...data.data, revision: data.revision };
}
export async function updateUserProfile(
  patch: UpdateProfileRequest,
  revision?: number,
) {
  const current = await getUserProfile();
  const { revision: loadedRevision, ...profile } = current;
  const { data } = await client.post("/user/profile/update", {
    profile: { ...profile, ...patch },
    revision: revision ?? loadedRevision,
  });
  return { ...data.data, revision: data.revision };
}
