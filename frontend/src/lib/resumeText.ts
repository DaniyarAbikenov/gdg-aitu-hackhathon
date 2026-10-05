const labels: Record<string, string> = {
  company: "Компания",
  role: "Должность",
  date_from: "Начало",
  date_to: "Окончание",
  location: "Место",
  responsibilities: "Задачи",
  achievements: "Достижения",
  institution: "Учебное заведение",
  degree: "Степень",
  field: "Специальность",
  name: "Название",
  description: "Описание",
  technologies: "Технологии",
  url: "Ссылка",
};
export function resumeText(value: string): string {
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
