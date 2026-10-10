import type { SkillNode } from "@/api/types";

export const STATUS_ORDER: SkillNode["status"][] = [
  "strength",
  "gap",
  "learning",
  "have",
];

export const STATUS_FILL: Record<SkillNode["status"], string> = {
  strength: "fill-emerald-500",
  have: "fill-slate-400",
  gap: "fill-rose-500",
  learning: "fill-sky-500",
};

export const STATUS_DOT: Record<SkillNode["status"], string> = {
  strength: "bg-emerald-500",
  have: "bg-slate-400",
  gap: "bg-rose-500",
  learning: "bg-sky-500",
};

/** The most recent practice score attributed to a skill, if it was practised. */
export function latestScore(node: SkillNode): number | null {
  return node.practice.length
    ? node.practice[node.practice.length - 1].score
    : null;
}
