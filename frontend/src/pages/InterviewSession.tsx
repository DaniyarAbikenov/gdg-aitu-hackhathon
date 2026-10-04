import { useState } from "react";
import { useInterviewStore } from "@/store/useInterviewStore";
import { answerInterview } from "@/api/interview";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTranslation } from "react-i18next";

const TypingIndicator = () => {
    const { t } = useTranslation();
    return (
        <div className="text-left">
            <div className="inline-block px-3 py-2 rounded-lg bg-muted">
                <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">{t("interview.session.typing")}</span>
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]"></span>
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]"></span>
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]"></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function InterviewSession() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {
        sessionId,
        currentQuestion,
        messages,
        addMessage,
        setResult,
        finished
    } = useInterviewStore();

    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);

    if (!sessionId) return <div>{t("interview.session.noActiveInterview")}</div>;

    async function send() {
        if (loading || !answer.trim()) return;

        addMessage({ role: "user", text: answer });
        const userAnswer = answer;
        setAnswer("");
        setLoading(true);

        const res = await answerInterview(sessionId, userAnswer);

        setResult({
            finished: res.finished,
            feedback: res.feedback,
            followUp: res.follow_up,
            nextQuestion: res.next_question
        });

        if (res.finished) {
            navigate("/interview/result");
        }

        setLoading(false);
    }

    return (
        <MainLayout>
            <div className="p-8 max-w-2xl mx-auto space-y-4">
                <h1 className="text-xl font-bold">{t("interview.session.title")}</h1>

                <div className="border rounded p-4 space-y-3 h-[60vh] overflow-y-auto bg-background">
                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={m.role === "user" ? "text-right" : "text-left"}
                        >
                            <div
                                className={`inline-block px-3 py-2 rounded-lg ${
                                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                                }`}
                            >
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {loading && <TypingIndicator />}
                </div>

                {!finished && (
                    <div className="flex gap-2">
                        <input
                            className="flex-1 border border-input rounded p-2 bg-background text-foreground"
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder={t("interview.session.yourAnswer")}
                            disabled={loading}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                        />
                        <Button disabled={loading || !answer.trim()} onClick={send}>
                            {loading ? t("interview.session.sending") : t("interview.session.send")}
                        </Button>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
