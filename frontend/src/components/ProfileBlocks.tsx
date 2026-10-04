import type { ResumeFields } from "@/types/resume";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { structured } from "@/api/resume";

export function ProfileBlocks({
  value,
  onChange,
  contacts = true,
  includeName = false,
}: {
  value: ResumeFields;
  onChange: (v: ResumeFields) => void;
  contacts?: boolean;
  includeName?: boolean;
}) {
  const data = structured(value);
  const set = (key: string, next: unknown) =>
    onChange({ ...data, [key]: next });
  const scalar = (key: keyof ResumeFields, label: string, area = false) => (
    <label className="block space-y-2" key={key}>
      <span className="text-sm font-medium">{label}</span>
      {area ? (
        <Textarea
          aria-label={label}
          value={String(data[key] || "")}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <Input
          aria-label={label}
          value={String(data[key] || "")}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </label>
  );
  const sections = [
    {
      key: "experience",
      title: "Опыт работы",
      empty: {
        company: "",
        role: "",
        date_from: "",
        date_to: "",
        location: "",
        responsibilities: "",
        achievements: [],
      },
      fields: [
        ["company", "Компания"],
        ["role", "Должность"],
        ["date_from", "Начало периода"],
        ["date_to", "Конец периода / настоящее время"],
        ["location", "Локация"],
        ["responsibilities", "Задачи и обязанности"],
        ["achievements", "Достижения — по одному на строку"],
      ],
    },
    {
      key: "education",
      title: "Образование",
      empty: { institution: "", degree: "", year_start: 0, year_end: 0 },
      fields: [
        ["institution", "Учебное заведение"],
        ["degree", "Степень / специальность"],
        ["year_start", "Год поступления"],
        ["year_end", "Год окончания"],
      ],
    },
    {
      key: "projects",
      title: "Проекты",
      empty: { title: "", description: "", tech: [] },
      fields: [
        ["title", "Название проекта"],
        ["description", "Задачи и результат проекта"],
        ["tech", "Технологии — по одной на строку"],
      ],
    },
  ] as const;
  return (
    <div className="space-y-6">
      {contacts && (
        <div className="grid gap-4 sm:grid-cols-2">
          {includeName && scalar("full_name", "Имя в резюме")}
          {scalar("phone", "Телефон")}
          {scalar("email", "Контактный email")}
          {scalar("location", "Город / локация")}
          {scalar("position", "Название позиции")}
        </div>
      )}
      {scalar("summary", "О себе", true)}
      {sections.map((section) => {
        const rows = (data[section.key] || []) as unknown as Record<
          string,
          unknown
        >[];
        return (
          <section key={section.key} className="space-y-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{section.title}</h2>
              <Button
                type="button"
                variant="outline"
                disabled={rows.length >= 40}
                onClick={() => set(section.key, [...rows, section.empty])}
              >
                Добавить: {section.title}
              </Button>
            </div>
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Добавьте подтверждённые факты — они пригодятся при сборке
                резюме.
              </p>
            )}
            {rows.map((row, index) => (
              <fieldset
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
                key={index}
              >
                <legend className="text-sm px-2">
                  {section.title} {index + 1}
                </legend>
                {section.fields.map(([key, label]) => {
                  const array = key === "achievements" || key === "tech";
                  const multiline =
                    array ||
                    key === "description" ||
                    key === "responsibilities";
                  const change = (text: string) =>
                    set(
                      section.key,
                      rows.map((r, i) =>
                        i !== index
                          ? r
                          : {
                              ...r,
                              [key]: array
                                ? text.split("\n")
                                : key.startsWith("year_")
                                  ? Number(text)
                                  : text,
                            },
                      ),
                    );
                  const text = Array.isArray(row[key])
                    ? (row[key] as string[]).join("\n")
                    : String(row[key] || "");
                  return (
                    <label
                      className={`space-y-1 ${multiline ? "sm:col-span-2" : ""}`}
                      key={key}
                    >
                      <Label asChild>
                        <span>{label}</span>
                      </Label>
                      {multiline ? (
                        <Textarea
                          value={text}
                          onChange={(e) => change(e.target.value)}
                        />
                      ) : (
                        <Input
                          type={key.startsWith("year_") ? "number" : "text"}
                          value={text}
                          onChange={(e) => change(e.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    set(
                      section.key,
                      rows.filter((_, i) => i !== index),
                    )
                  }
                >
                  Удалить запись {index + 1}
                </Button>
              </fieldset>
            ))}
          </section>
        );
      })}
      {scalar("certificates", "Сертификаты и награды", true)}
      {scalar("languages", "Языки и уровень владения", true)}
    </div>
  );
}
