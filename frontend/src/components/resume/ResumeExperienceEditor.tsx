import { useTranslation } from "react-i18next";
import { useResumeStore } from "@/store/resumeStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ResumeExperienceEditor() {
    const { t } = useTranslation();
    const { fields, updateField } = useResumeStore();
    const experience = fields?.experience || [];

    function addExperience() {
        updateField("experience", [
            ...experience,
            {
                company: "",
                role: "",
                date_from: "",
                date_to: "",
                achievements: [],
            },
        ]);
    }

    function update(index: number, key: string, value: any) {
        const updated = [...experience];
        // @ts-ignore
        updated[index][key] = value;
        updateField("experience", updated);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Label>{t("resume.editors.experience.label")}</Label>
                <Button onClick={addExperience}>{t("resume.editors.experience.add")}</Button>
            </div>

            {experience.map((exp, i) => (
                <div key={i} className="border rounded p-4 space-y-3">
                    <Input
                        placeholder={t("resume.editors.experience.company")}
                        value={exp.company}
                        onChange={(e) => update(i, "company", e.target.value)}
                    />

                    <Input
                        placeholder={t("resume.editors.experience.role")}
                        value={exp.role}
                        onChange={(e) => update(i, "role", e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            placeholder={t("resume.editors.experience.dateFrom")}
                            value={exp.date_from}
                            onChange={(e) => update(i, "date_from", e.target.value)}
                        />
                        <Input
                            placeholder={t("resume.editors.experience.dateTo")}
                            value={exp.date_to}
                            onChange={(e) => update(i, "date_to", e.target.value)}
                        />
                    </div>

                    <Textarea
                        rows={3}
                        placeholder={t("resume.editors.experience.achievements")}
                        value={(exp.achievements || []).join(", ")}
                        onChange={(e) =>
                            update(i, "achievements", e.target.value.split(",").map((s) => s.trim()))
                        }
                    />
                </div>
            ))}
        </div>
    );
}
