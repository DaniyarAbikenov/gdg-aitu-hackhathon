import { DictationButton } from "@/components/DictationButton";
import { getErrorMessage } from "@/lib/errors";
import { useState, useEffect } from "react";
import { useInterviewStore } from "@/store/useInterviewStore";
import { answerInterview, getInterview } from "@/api/interview";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTranslation } from "react-i18next";

const TypingIndicator = () => {
  const { t } = useTranslation();
  return (
    <div className="text-left">
      <div className="inline-block px-3 py-2 rounded-lg bg-muted">
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">
            {t("interview.session.typing")}
          </span>
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
  const { sessionId, messages, finished } = useInterviewStore();

  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const [params] = useSearchParams();
  const id = params.get("id") || sessionId;
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (id)
      getInterview(id)
        .then((r) => {
          useInterviewStore.getState().hydrate(r);
          setReady(true);
        })
        .catch((e) => setError(e.message));
  }, [id]);
  if (!id)
    return (
      <MainLayout>
        <div>{t("interview.session.noActiveInterview")}</div>
      </MainLayout>
    );

  async function send() {
    if (loading || !answer.trim()) return;

    setLoading(true);
    try {
      const record = await answerInterview(
        id,
        answer,
        useInterviewStore.getState().revision,
      );
      useInterviewStore.getState().hydrate(record);
      setAnswer("");
      setError("");
      if (record.finished) navigate(`/interview/result?id=${record.id}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">{t("interview.session.title")}</h1>

        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="border rounded p-4 space-y-3 h-[60vh] overflow-y-auto bg-background">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "text-right" : "text-left"}
            >
              <div
                className={`inline-block px-3 py-2 rounded-lg ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && <TypingIndicator />}
        </div>

        {!finished && (
          <DictationButton
            disabled={loading || !ready}
            onText={(text) =>
              setAnswer((previous) => (previous ? previous + " " + text : text))
            }
          />
        )}
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
            <Button
              disabled={!ready || loading || !answer.trim()}
              onClick={send}
            >
              {loading
                ? t("interview.session.sending")
                : t("interview.session.send")}
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
