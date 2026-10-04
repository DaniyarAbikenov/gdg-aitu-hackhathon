import { useTranslation } from "react-i18next";
import { useResumeStore } from "@/store/resumeStore";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ResumeSummaryEditor() {
    const { t } = useTranslation();
    const { fields, updateField } = useResumeStore();

    return (
        <div className="space-y-2">
            <Label>{t("resume.editors.summary.label")}</Label>
            <Textarea
                rows={5}
                value={fields?.summary || ""}
                onChange={(e) => updateField("summary", e.target.value)}
                placeholder={t("resume.editors.summary.placeholder")}
            />
        </div>
    );
}
