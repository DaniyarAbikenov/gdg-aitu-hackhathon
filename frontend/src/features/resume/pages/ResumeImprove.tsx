import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { resumeText } from "../resumeText";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Improvement } from "../types";
import {
  resumeQuery,
  useAdaptResume,
  useApplyProposal,
  useAssessment,
  useResume,
} from "../api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";

import { useResumeStore } from "../store";

import { useVacancyContext } from "@/features/applications/useVacancyContext";
import { VacancyContext } from "@/features/applications/components/VacancyContext";
import { useCapabilities } from "@/api/system";
export default function ResumeImprove() {
  useLocale();
  const capabilities = useCapabilities();
  const { vacancy, error: contextError } = useVacancyContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resumeId } = useParams();
  const [jdText, setJdText] = useState(useResumeStore.getState().jdText);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [improvements, setImprovements] = useState<Improvement[]>(
    useResumeStore.getState().resumeId === resumeId
      ? useResumeStore.getState().improvements
      : [],
  );
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const resume = useResume(resumeId!);
  const assessment = useAssessment(resumeId!);
  const adapt = useAdaptResume();
  const applyProposal = useApplyProposal();
  const [hydrated, setHydrated] = useState<string | null>(null);
  const loaded = resume.isFetchedAfterMount && assessment.isFetchedAfterMount;
  const loadFailure = resume.error ?? assessment.error;
  const shownError =
    error ?? (loaded && loadFailure ? getErrorMessage(loadFailure) : null);

  useEffect(() => {
    // Seed the draft and the form from the freshly loaded records once.
    if (!loaded || hydrated === resumeId) return;
    if (!resume.isSuccess || !assessment.isSuccess) return;
    const record = resume.data;
    const data = assessment.data;
    useResumeStore.setState({
      resumeId: resumeId!,
      fields: record.fields,
      revision: record.revision,
      jdText: data?.job || record.jd_text,
    });
    const fromVacancy = new URLSearchParams(window.location.search).has(
      "vacancy",
    );
    if (!new URLSearchParams(window.location.search).get("vacancy"))
      setJdText(data?.job || record.jd_text);
    setImprovements(fromVacancy ? [] : data?.improvements || []);
    setAnalyzed(!fromVacancy && Boolean(data));
    setHydrated(resumeId!);
  }, [
    loaded,
    hydrated,
    resumeId,
    resume.isSuccess,
    resume.data,
    assessment.isSuccess,
    assessment.data,
  ]);

  useEffect(() => {
    if (vacancy) {
      setJdText(vacancy.data.description);
      setImprovements([]);
      setAnalyzed(false);
    }
  }, [vacancy]);
  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    try {
      const current = await queryClient.fetchQuery(resumeQuery(resumeId!));
      useResumeStore.setState({
        resumeId: resumeId!,
        fields: current.fields,
        revision: current.revision,
        jdText,
      });
      const resp = await adapt.mutateAsync({
        id: resumeId!,
        jd_text: jdText,
        revision: current.revision,
      });
      setImprovements(resp.improvements);
      setAnalyzed(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">{t("resume.improve.title")}</h1>
        <VacancyContext vacancy={vacancy} />
        {contextError && <p role="alert">{contextError}</p>}

        {/* 🔹 Ввод JD */}
        <div className="space-y-2">
          <label className="font-semibold">
            {t("resume.improve.jobDescription")}
          </label>
          <textarea
            className="w-full border rounded p-3 h-40"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder={t("resume.improve.jobDescriptionPlaceholder")}
          />
        </div>

        {/* 🔹 Кнопка Continue */}
        <Button
          onClick={handleAnalyze}
          disabled={!capabilities?.ai || loading || jdText.trim().length < 30}
        >
          {loading
            ? t("resume.improve.analyzing")
            : t("resume.improve.continue")}
        </Button>

        {capabilities && !capabilities.ai && (
          <p className="text-sm text-muted-foreground">{tr("copy.c463")}</p>
        )}
        {/* 🔹 Ошибка */}
        {shownError && <div className="text-red-600">{shownError}</div>}

        {analyzed && !loading && improvements.length === 0 && (
          <p role="status">{tr("copy.c464")}</p>
        )}
        <Link
          className="text-primary underline block"
          to={`/resume/${resumeId}/edit`}
        >
          {tr("copy.c465")}
        </Link>
        <Link
          className="text-primary underline"
          to={`/resume/${resumeId}/generate`}
        >
          {tr("copy.c180")}
        </Link>
        {/* 🔹 Список улучшений */}
        {improvements.length > 0 && (
          <div className="space-y-6 mt-8">
            <h2 className="text-xl font-semibold">
              {t("resume.improve.suggestedImprovements")}
            </h2>

            {improvements.map((impr) => (
              <div
                key={impr.id}
                className="border rounded p-4 space-y-2 bg-background"
              >
                <div className="font-bold">
                  {t("resume.improve.section")}: {impr.section}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("resume.improve.type")}: {tr("copy.c466")}
                </div>

                {impr.before && (
                  <div>
                    <div className="text-muted-foreground text-sm">
                      {t("resume.improve.before")}:
                    </div>
                    <pre className="bg-muted p-2 rounded text-sm whitespace-pre-wrap">
                      {resumeText(impr.before)}
                    </pre>
                  </div>
                )}

                {impr.after && (
                  <div>
                    <div className="text-muted-foreground text-sm">
                      {t("resume.improve.after")}:
                    </div>
                    <pre className="bg-muted p-2 rounded text-sm whitespace-pre-wrap">
                      {resumeText(impr.after)}
                    </pre>
                  </div>
                )}

                <Button
                  variant="outline"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const current = useResumeStore.getState();
                      const saved = await applyProposal.mutateAsync({
                        id: resumeId!,
                        revision: current.revision,
                        proposal_id: impr.id,
                      });
                      useResumeStore.setState({
                        fields: saved.fields,
                        revision: saved.revision,
                      });
                      setImprovements((items) =>
                        items.filter((item) => item.section !== impr.section),
                      );
                    } catch (e) {
                      setError(getErrorMessage(e));
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {tr("copy.c467")}
                </Button>
                <div className="text-sm">
                  <span className="font-semibold">
                    {t("resume.improve.reason")}:
                  </span>{" "}
                  {impr.reason}
                </div>
              </div>
            ))}

            {/* Кнопка Generate PDF */}
            <Button
              className="w-full mt-4"
              onClick={() => navigate(`/resume/${resumeId}/generate`)}
            >
              {t("resume.improve.generatePdf")}
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
