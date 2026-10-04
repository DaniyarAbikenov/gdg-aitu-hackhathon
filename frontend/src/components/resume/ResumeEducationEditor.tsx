import { useTranslation } from "react-i18next";
import { useResumeStore } from "@/store/resumeStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ResumeEducationEditor() {
    const { t } = useTranslation();
    const { fields, updateField } = useResumeStore();
    const education = fields?.education || [];

    function addEducation() {
        updateField("education", [
            ...education,
            { institution: "", degree: "", year_start: 0, year_end: 0 },
        ]);
    }

    function update(index: number, key: string, value: any) {
        const updated = [...education];
        // @ts-ignore
        updated[index][key] = value;
        updateField("education", updated);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Label>{t("resume.editors.education.label")}</Label>
                <Button onClick={addEducation}>{t("resume.editors.education.add")}</Button>
            </div>

            {education.map((ed, i) => (
                <div key={i} className="border rounded p-4 space-y-3">
                    <Input
                        placeholder={t("resume.editors.education.institution")}
                        value={ed.institution}
                        onChange={(e) => update(i, "institution", e.target.value)}
                    />
                    <Input
                        placeholder={t("resume.editors.education.degree")}
                        value={ed.degree}
                        onChange={(e) => update(i, "degree", e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            placeholder={t("resume.editors.education.startYear")}
                            value={ed.year_start || ""}
                            onChange={(e) => update(i, "year_start", Number(e.target.value))}
                        />
                        <Input
                            placeholder={t("resume.editors.education.endYear")}
                            value={ed.year_end || ""}
                            onChange={(e) => update(i, "year_end", Number(e.target.value))}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
