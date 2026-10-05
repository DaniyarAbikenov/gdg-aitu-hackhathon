import type { ResumeFields } from "@/types/resume";
import { useTranslation } from "react-i18next";
import { useResumeStore } from "@/store/resumeStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ResumeProjectsEditor() {
  const { t } = useTranslation();
  const { fields, updateField } = useResumeStore();
  const projects = fields?.projects || [];

  function addProject() {
    updateField("projects", [
      ...projects,
      { title: "", description: "", tech: [] },
    ]);
  }

  function update<K extends keyof ResumeFields["projects"][number]>(
    index: number,
    key: K,
    value: ResumeFields["projects"][number][K],
  ) {
    updateField(
      "projects",
      projects.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Label>{t("resume.editors.projects.label")}</Label>
        <Button onClick={addProject}>{t("resume.editors.projects.add")}</Button>
      </div>

      {projects.map((p, i) => (
        <div key={i} className="border rounded p-4 space-y-3">
          <Input
            placeholder={t("resume.editors.projects.title")}
            value={p.title}
            onChange={(e) => update(i, "title", e.target.value)}
          />

          <Textarea
            rows={3}
            placeholder={t("resume.editors.projects.description")}
            value={p.description}
            onChange={(e) => update(i, "description", e.target.value)}
          />

          <Input
            placeholder={t("resume.editors.projects.tech")}
            value={(p.tech || []).join(", ")}
            onChange={(e) =>
              update(
                i,
                "tech",
                e.target.value.split(",").map((s) => s.trim()),
              )
            }
          />
        </div>
      ))}
    </div>
  );
}
