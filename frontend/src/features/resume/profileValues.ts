import { tr } from "@/i18n/copy";

export function sectionName(section: string) {
  const names: Record<string, string> = {
    summary: "copy.c090",
    experience: "copy.c068",
    education: "copy.c076",
    projects: "copy.c081",
    skills: "copy.c104",
    certificates: "copy.c444",
    languages: "copy.c445",
    full_name: "copy.c085",
    phone: "copy.c086",
    email: "copy.c087",
    location: "copy.c088",
    awards: "linked.awards",
    interests: "linked.interests",
  };
  return tr(names[section] ?? section);
}

/** A readable one-paragraph view of a profile or resume value. */
export function describe(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(describe).join(", ");
  if (typeof value === "object") {
    const entry = value as Record<string, unknown>;
    return [
      entry.role,
      entry.company,
      entry.degree,
      entry.institution,
      entry.title,
      [entry.date_from, entry.date_to].filter(Boolean).join(" — "),
      entry.year || "",
      entry.responsibilities,
      entry.description,
      entry.detail,
      Array.isArray(entry.achievements) ? entry.achievements.join("; ") : "",
      Array.isArray(entry.tech) ? entry.tech.join(", ") : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return String(value);
}

/** Deep equality that ignores key order, for comparing a draft with saved fields. */
export function sameValue(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value as object)
              .sort()
              .map((k) => [
                k,
                canonical((value as Record<string, unknown>)[k]),
              ]),
          )
        : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
