import { tr, useLocale } from "@/i18n/copy";
import {
  MonthYearPicker,
  YearPicker,
  canonicalPeriod,
} from "@/components/MonthYearPicker";
import type { ResumeFields } from "@/features/resume/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { structured } from "@/features/resume/api";

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
  useLocale();
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
      title: tr("copy.c068"),
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
        ["company", tr("copy.c069")],
        ["role", tr("copy.c070")],
        ["date_from", tr("copy.c071")],
        ["date_to", tr("copy.c072")],
        ["location", tr("copy.c073")],
        ["responsibilities", tr("copy.c074")],
        ["achievements", tr("copy.c075")],
      ],
    },
    {
      key: "education",
      title: tr("copy.c076"),
      empty: { institution: "", degree: "", year_start: 0, year_end: 0 },
      fields: [
        ["institution", tr("copy.c077")],
        ["degree", tr("copy.c078")],
        ["year_start", tr("copy.c079")],
        ["year_end", tr("copy.c080")],
      ],
    },
    {
      key: "projects",
      title: tr("copy.c081"),
      empty: { title: "", description: "", tech: [] },
      fields: [
        ["title", tr("copy.c082")],
        ["description", tr("copy.c083")],
        ["tech", tr("copy.c084")],
      ],
    },
    {
      key: "awards",
      title: tr("linked.awards"),
      empty: { title: "", detail: "", year: 0 },
      fields: [
        ["title", tr("linked.awardTitle")],
        ["year", tr("linked.awardYear")],
        ["detail", tr("linked.awardDetail")],
      ],
    },
  ] as const;
  return (
    <div className="space-y-6">
      {contacts && (
        <div className="grid gap-4 sm:grid-cols-2">
          {includeName && scalar("full_name", tr("copy.c085"))}
          {scalar("phone", tr("copy.c086"))}
          {scalar("email", tr("copy.c087"))}
          {scalar("location", tr("copy.c088"))}
          {scalar("position", tr("copy.c089"))}
        </div>
      )}
      {scalar("summary", tr("copy.c090"), true)}
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
                {tr("copy.c091")} {section.title}
              </Button>
            </div>
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">{tr("copy.c092")}</p>
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
                    key === "detail" ||
                    key === "responsibilities";
                  const year = key === "year" || key.startsWith("year_");
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
                                : year
                                  ? Number(text)
                                  : text,
                            },
                      ),
                    );
                  const text = Array.isArray(row[key])
                    ? (row[key] as string[]).join("\n")
                    : String(row[key] || "");
                  if (key === "date_from" || key === "date_to")
                    return (
                      <MonthYearPicker
                        key={key}
                        label={label}
                        value={text}
                        allowPresent={key === "date_to"}
                        onChange={change}
                      />
                    );
                  if (year)
                    return (
                      <label key={key} className="space-y-1">
                        <span className="text-sm font-medium">{label}</span>
                        <YearPicker
                          label={label}
                          value={Number(text) || 0}
                          onChange={(v) => change(String(v))}
                        />
                      </label>
                    );
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
                          aria-label={label}
                          value={text}
                          onChange={(e) => change(e.target.value)}
                        />
                      ) : (
                        <Input
                          type="text"
                          value={text}
                          onChange={(e) => change(e.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
                {section.key === "experience" &&
                  Boolean(row.date_from) &&
                  Boolean(row.date_to) &&
                  canonicalPeriod(String(row.date_from)) &&
                  canonicalPeriod(String(row.date_to)) &&
                  canonicalPeriod(String(row.date_to)) !== "present" &&
                  canonicalPeriod(String(row.date_from)).padEnd(7, "-01") >
                    canonicalPeriod(String(row.date_to)).padEnd(7, "-12") && (
                    <p role="alert" className="text-destructive sm:col-span-2">
                      {tr("period.order")}
                    </p>
                  )}
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
                  {tr("copy.c093")} {index + 1}
                </Button>
              </fieldset>
            ))}
          </section>
        );
      })}
      {scalar("certificates", tr("copy.c094"), true)}
      {scalar("languages", tr("copy.c095"), true)}
      <label className="block space-y-2">
        <span className="text-sm font-medium">{tr("linked.interests")}</span>
        <Textarea
          aria-label={tr("linked.interests")}
          placeholder={tr("linked.interestsHint")}
          value={(data.interests ?? []).join("\n")}
          onChange={(e) => set("interests", e.target.value.split("\n"))}
          onBlur={(e) =>
            set(
              "interests",
              e.target.value
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            )
          }
        />
      </label>
    </div>
  );
}
