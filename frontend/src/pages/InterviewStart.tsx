import { useState } from "react";
import { startInterview } from "@/api/interview";
import { useInterviewStore } from "@/store/useInterviewStore";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTranslation } from "react-i18next";

export default function InterviewStart() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { reset, setSession, setInitialQuestion } = useInterviewStore();

    const [company, setCompany] = useState("");
    const [job, setJob] = useState("");
    const [stack, setStack] = useState("");
    const [style, setStyle] = useState("theoretical");

    const [loading, setLoading] = useState(false);

    async function handleStart() {
        if (loading) return;

        setLoading(true);
        reset();

        try {
            const resp = await startInterview({
                company_description: company,
                job_description: job,
                tech_stack: stack,
                style
            });

            setSession(resp.session_id);
            setInitialQuestion(resp.question, resp.total_questions);

            navigate("/interview/session");
        } finally {
            setLoading(false);
        }
    }

    return (
        <MainLayout>
            <div className="p-8 max-w-xl mx-auto space-y-4">
                <h1 className="text-2xl font-bold">Start Interview</h1>

                <Textarea 
                    value={company} 
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={t("interview.start.companyPlaceholder")}
                />
                <Textarea 
                    value={job} 
                    onChange={(e) => setJob(e.target.value)}
                    placeholder={t("interview.start.jobPlaceholder")}
                />
                <Textarea 
                    value={stack} 
                    onChange={(e) => setStack(e.target.value)}
                    placeholder={t("interview.start.stackPlaceholder")}
                />

                <select
                    className="border p-2 rounded"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                >
                    <option value="theoretical">Theoretical</option>
                    <option value="practical">Practical</option>
                    <option value="mixed">Mixed</option>
                </select>

                <Button disabled={loading} onClick={handleStart} className="w-full">
                    {loading ? "Starting…" : "Start"}
                </Button>
            </div>
        </MainLayout>
    );
}
