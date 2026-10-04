import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  type Improvement,
  improveResume,
  getResume,
  saveVersion,
  saveResumeFields,
} from "@/api/resume";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";

import { useResumeStore } from "@/store/resumeStore";

export default function ResumeImprove() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resumeId } = useParams();
  const [jdText, setJdText] = useState(useResumeStore.getState().jdText);
  const [loading, setLoading] = useState(false);
  const [improvements, setImprovements] = useState<Improvement[]>(
    useResumeStore.getState().resumeId === resumeId
      ? useResumeStore.getState().improvements
      : [],
  );
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    try {
      const current = await getResume(resumeId!);
      useResumeStore.setState({
        resumeId: resumeId!,
        fields: current.fields,
        revision: current.revision,
        jdText,
      });
      const resp = await improveResume(resumeId!, jdText, current.revision);
      setImprovements(resp.improvements);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error analyzing resume");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">{t("resume.improve.title")}</h1>

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
        <Button onClick={handleAnalyze} disabled={loading}>
          {loading
            ? t("resume.improve.analyzing")
            : t("resume.improve.continue")}
        </Button>

        {/* 🔹 Ошибка */}
        {error && <div className="text-red-600">{error}</div>}

        {/* 🔹 Список улучшений */}
        {improvements.length > 0 && (
          <div className="space-y-6 mt-8">
            <h2 className="text-xl font-semibold">
              {t("resume.improve.suggestedImprovements")}
            </h2>

            {improvements.map((impr) => (
              <div
                key={impr.id}
                className="border rounded p-4 space-y-2 bg-white"
              >
                <div className="font-bold">
                  {t("resume.improve.section")}: {impr.section}
                </div>
                <div className="text-sm text-gray-600">
                  {t("resume.improve.type")}: {"Предложение"}
                </div>

                {impr.before && (
                  <div>
                    <div className="text-gray-500 text-sm">
                      {t("resume.improve.before")}:
                    </div>
                    <pre className="bg-gray-100 p-2 rounded text-sm whitespace-pre-wrap">
                      {impr.before}
                    </pre>
                  </div>
                )}

                {impr.after && (
                  <div>
                    <div className="text-gray-500 text-sm">
                      {t("resume.improve.after")}:
                    </div>
                    <pre className="bg-gray-50 p-2 rounded text-sm whitespace-pre-wrap">
                      {impr.after}
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
                      const value =
                        impr.section === "skills"
                          ? impr.after
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : ["experience", "education", "projects"].includes(
                                impr.section,
                              )
                            ? JSON.parse(impr.after)
                            : impr.after;
                      const fields = {
                        ...current.fields,
                        [impr.section]: value,
                      };
                      await saveVersion(
                        resumeId!,
                        fields,
                        current.revision,
                        `Адаптация: ${impr.section}`,
                        jdText,
                      );
                      const saved = await saveResumeFields(
                        resumeId!,
                        fields,
                        current.revision,
                      );
                      useResumeStore.setState({
                        fields: saved.fields,
                        revision: saved.revision,
                      });
                      setImprovements((items) =>
                        items.filter((item) => item.id !== impr.id),
                      );
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Применить и сохранить версию
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
