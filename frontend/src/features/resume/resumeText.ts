import { tr } from "@/i18n/copy";
export function resumeText(value: string): string {
  const labels: Record<string, string> = {
    company: tr("copy.c069"),
    role: tr("copy.c070"),
    date_from: tr("copy.c130"),
    date_to: tr("copy.c131"),
    location: tr("copy.c132"),
    responsibilities: tr("copy.c133"),
    achievements: tr("copy.c134"),
    institution: tr("copy.c077"),
    degree: tr("copy.c135"),
    field: tr("copy.c136"),
    name: tr("copy.c137"),
    description: tr("copy.c138"),
    technologies: tr("copy.c139"),
    url: tr("copy.c140"),
  };

  try {
    const data = JSON.parse(value);
    if (Array.isArray(data))
      return data
        .map((item) =>
          typeof item === "object" && item
            ? Object.entries(item)
                .filter(
                  ([, v]) => Boolean(v) && (!Array.isArray(v) || v.length),
                )
                .map(
                  ([k, v]) =>
                    `${labels[k] || k}: ${Array.isArray(v) ? v.join("; ") : String(v)}`,
                )
                .join("\n")
            : String(item),
        )
        .join("\n\n");
  } catch {
    /* Plain text sections need no conversion. */
  }
  return value;
}
