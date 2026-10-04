import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { uploadResume, extractResume } from "@/api/resume";
import { useResumeStore } from "@/store/resumeStore";
import { MainLayout } from "@/components/layout/MainLayout";

export default function ResumeUpload() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setFields } = useResumeStore();

    const [loading, setLoading] = useState(false);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);

        // ✅ 1. Upload to GCS
        const { resume_id } = await uploadResume(file);

        // ✅ 2. Extract fields
        const extracted = await extractResume(resume_id);

        setFields(extracted.fields);

        setLoading(false);

        // ✅ 3. Move to editor
        navigate(`/resume/${resume_id}/edit`);
    }

    return (
        <MainLayout>
            <div className="p-8 max-w-xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">{t("resume.uploadTitle")}</h1>

                <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleUpload}
                    className="border p-3 w-full"
                />

                {loading && <div className="mt-4">{t("resume.upload.processing")}</div>}
            </div>
        </MainLayout>
    );
}
