import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { ProfileBlocks } from "@/features/profile/components/ProfileBlocks";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  structured,
  useAdaptResume,
  useResume,
  useSaveResumeFields,
} from "../api";
import { useResumeStore } from "../store";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";

import { ResumeSkillsEditor } from "../components/ResumeSkillsEditor";
import { ProfileUpdates } from "../components/ProfileUpdates";
import { sameValue } from "../profileValues";

export default function ResumeEdit() {
  useLocale();
  const { t } = useTranslation();
  const { resumeId } = useParams();
  const navigate = useNavigate();

  const { fields, setFields, jdText, setJdText } = useResumeStore();

  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resume = useResume(resumeId!);
  const saveFields = useSaveResumeFields();
  const adapt = useAdaptResume();
  const loadError = resume.isFetchedAfterMount ? resume.error : null;
  const loading = hydrated !== resumeId && !loadError;

  useEffect(() => {
    // Copy the freshly loaded record into the draft once; later edits stay local.
    const record = resume.data;
    if (!resumeId || !resume.isFetchedAfterMount || !record) return;
    if (resume.isError || hydrated === resumeId) return;
    useResumeStore.setState({
      resumeId,
      revision: record.revision,
      jdText: record.jd_text,
      improvements: [],
    });
    setFields(record.fields || {});
    setHydrated(resumeId);
  }, [
    resumeId,
    resume.data,
    resume.isFetchedAfterMount,
    resume.isError,
    hydrated,
    setFields,
  ]);

  async function handleContinue() {
    if (isSubmitting) return; // защита от двойного клика
    setIsSubmitting(true);

    try {
      const saved = await saveFields.mutateAsync({
        id: resumeId!,
        fields: fields!,
        revision: useResumeStore.getState().revision,
      });
      useResumeStore.getState().setRevision(saved.revision);
      const result = await adapt.mutateAsync({
        id: resumeId!,
        jd_text: jdText,
        revision: saved.revision,
      });

      useResumeStore.getState().setImprovements(result.improvements);

      navigate(`/resume/${resumeId}/improvements`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }
  if (loading)
    return (
      <MainLayout>
        <div className="p-8 text-center">{t("resume.edit.loading")}</div>
      </MainLayout>
    );

  return (
    <MainLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">{t("resume.edit.title")}</h1>

        {(error || loadError) && (
          <p role="alert" className="text-destructive">
            {error || getErrorMessage(loadError)}
          </p>
        )}
        <ProfileUpdates
          resumeId={resumeId!}
          dirty={!sameValue(fields ?? {}, resume.data?.fields ?? {})}
          onApplied={(record) => {
            useResumeStore.getState().setRevision(record.revision);
            setFields(structured(record.fields));
          }}
        />
        {/* ✅ блок редакторов */}
        <div className="space-y-8">
          <ProfileBlocks
            includeName
            value={fields || {}}
            onChange={setFields}
          />
          <ResumeSkillsEditor />
        </div>

        {/* ✅ поле для текста вакансии */}
        <div className="space-y-2">
          <label className="font-medium text-sm">
            {t("resume.edit.jobDescription")}
          </label>
          <textarea
            className="w-full p-3 border rounded-md h-40"
            placeholder={t("resume.edit.jobDescriptionPlaceholder")}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
        </div>

        <Button
          variant="outline"
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true);
            try {
              const saved = await saveFields.mutateAsync({
                id: resumeId!,
                fields: fields!,
                revision: useResumeStore.getState().revision,
              });
              useResumeStore.getState().setRevision(saved.revision);
              setError("");
            } catch (e) {
              setError(getErrorMessage(e));
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {tr("copy.c460")}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/resume/${resumeId}`)}
        >
          {tr("copy.c461")}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/resume/${resumeId}/generate`)}
        >
          PDF
        </Button>
        {/* ✅ кнопка перехода к улучшениям */}
        <Button
          onClick={handleContinue}
          className="w-full mt-6 text-lg py-6"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
              {t("resume.edit.processing")}
            </div>
          ) : (
            t("resume.edit.continueButton")
          )}
        </Button>
      </div>
    </MainLayout>
  );
}
