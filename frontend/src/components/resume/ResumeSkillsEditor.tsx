import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useResumeStore } from "@/store/resumeStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export function ResumeSkillsEditor() {
    const { t } = useTranslation();
    const { fields, updateField } = useResumeStore();
    const skills = fields?.skills || [];

    const [skillInput, setSkillInput] = useState("");

    function addSkill() {
        if (!skillInput.trim()) return;

        updateField("skills", [...skills, skillInput.trim()]);
        setSkillInput("");
    }

    function removeSkill(s: string) {
        updateField("skills", skills.filter((i) => i !== s));
    }

    return (
        <div className="space-y-3">
            <Label>{t("resume.editors.skills.label")}</Label>

            <div className="flex gap-2">
                <Input
                    value={skillInput}
                    placeholder={t("resume.editors.skills.placeholder")}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                />
                <Button onClick={addSkill}>{t("resume.editors.skills.add")}</Button>
            </div>

            <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                    <Badge key={s} className="gap-1">
                        {s}
                        <button onClick={() => removeSkill(s)} className="ml-1 text-red-400">
                            ×
                        </button>
                    </Badge>
                ))}
            </div>
        </div>
    );
}
