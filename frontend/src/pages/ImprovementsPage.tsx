import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getResumeImprovements } from "@/api/resume";
import { Button } from "@/components/ui/button";
import {MainLayout} from "@/components/layout/MainLayout.tsx";
import client from "@/api/client.ts";

export default function ImprovementsPage() {
    const { t } = useTranslation();
    const { resumeId } = useParams();
    const [improvements, setImprovements] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [pdfLoading, setPdfLoading] = useState(false);


    const handleGeneratePDF = async () => {
        if (!resumeId) {
            alert("Please ensure the resume and job description are available");
            return;
        }

        setPdfLoading(true);
        try {
            const response = await client.post(`/resume/${resumeId}/generate`, {
                template: "modern",
                jd_text: ""
            });

            const pdfUrl = response.data.pdf_url;
            window.open(pdfUrl, "_blank");
        } catch (error) {
            console.error("Error generating PDF", error);
            alert("Error generating PDF");
        } finally {
            setPdfLoading(false);
        }
    };
    useEffect(() => {
        async function fetchImprovements() {
            if (!resumeId) return;

            try {
                const response = await getResumeImprovements(resumeId);
                setImprovements(response.improvements);
            } catch (error) {
                console.error("Failed to fetch improvements", error);
            } finally {
                setLoading(false);
            }
        }

        fetchImprovements();
    }, [resumeId]);

    const handleGeneratePdf = () => {
        navigate(`/resume/${resumeId}/generate`);
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="p-8 text-center">{t("resume.improvements.loading")}</div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-8 max-w-4xl mx-auto space-y-8">
                <h1 className="text-2xl font-bold">{t("resume.improvements.title")}</h1>

                <div className="space-y-4">
                    {improvements.length > 0 ? (
                        <ul>
                            {improvements.map((improvement, index) => (
                                <li key={index} className="py-2 px-4 border-b">
                                    {improvement}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>{t("resume.improvements.noImprovements")}</p>
                    )}
                </div>

                <Button onClick={handleGeneratePDF} disabled={pdfLoading} className="w-full mt-4">
                    {pdfLoading ? t("resume.improvements.generating") : t("resume.improvements.generateButton")}
                </Button>
            </div>

        </MainLayout>
    );
}
