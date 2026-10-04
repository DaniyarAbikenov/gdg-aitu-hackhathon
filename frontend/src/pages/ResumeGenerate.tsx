import { MainLayout } from "@/components/layout/MainLayout";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { generateResume } from "@/api/resume";
import { Button } from "@/components/ui/button";

export default function ResumeGenerate() {
  const { t } = useTranslation();
  const { resumeId } = useParams();
  const [template, setTemplate] = useState("modern");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );
  async function handleGenerate() {
    setBusy(true);
    try {
      const data = await generateResume(resumeId!, template);
      setPdfUrl(data.pdf_url);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">{t("resume.generate.title")}</h1>

        <select
          className="border p-2 rounded w-full"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          <option value="modern">{t("resume.generate.modern")}</option>
          <option value="classic">{t("resume.generate.classic")}</option>
          <option value="minimalist">{t("resume.generate.minimalist")}</option>
        </select>

        {error && <p role="alert">{error}</p>}
        <Button className="w-full" disabled={busy} onClick={handleGenerate}>
          {t("resume.generate.generatePdf")}
        </Button>

        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            className="block text-blue-600 underline text-center"
          >
            {t("resume.generate.downloadPdf")}
          </a>
        )}
        <a
          className="block text-primary underline"
          href={`/api/resume/${resumeId}/docx`}
        >
          Скачать Word (.docx)
        </a>
      </div>
    </MainLayout>
  );
}
