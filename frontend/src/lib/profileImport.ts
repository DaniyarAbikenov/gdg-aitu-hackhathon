import type { ResumeFields } from "@/types/resume";
import { structured } from "@/api/resume";
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
const skillKey = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export function mergeProfileImport(
  current: ResumeFields,
  imported: ResumeFields,
  selected: (keyof ResumeFields)[],
): ResumeFields {
  const merged = structured(current);
  const source = structured(imported);
  for (const key of selected) {
    const next = source[key];
    if (Array.isArray(next)) {
      const existing = Array.isArray(merged[key])
        ? (merged[key] as unknown[])
        : [];
      const values = [...existing];
      const identity = (v: unknown) =>
        key === "skills" ? skillKey(String(v)) : canonical(v);
      const known = new Set(values.map(identity));
      for (const item of next)
        if (!known.has(identity(item))) {
          values.push(item);
          known.add(identity(item));
        }
      Object.assign(merged, { [key]: values });
    } else if (typeof next === "string" && next.trim())
      Object.assign(merged, { [key]: next });
  }
  return merged;
}
