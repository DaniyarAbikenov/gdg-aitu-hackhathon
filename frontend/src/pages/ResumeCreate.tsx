import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import type { Profile } from "@/types/career";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useVacancyContext } from "@/hooks/useVacancyContext";
import { VacancyContext } from "@/components/VacancyContext";
import { useCapabilities } from "@/hooks/useCapabilities";
function sectionStatus(value: unknown) {
  if (Array.isArray(value))
    return tr("dynamic.entries", { count: value.length });
  return value ? tr("copy.c451") : tr("copy.c452");
}

export default function ResumeCreate() {
  useLocale();
  const blocks = {
    summary: tr("copy.c090"),
    experience: tr("copy.c068"),
    education: tr("copy.c076"),
    projects: tr("copy.c081"),
    skills: tr("copy.c104"),
    certificates: tr("copy.c444"),
    languages: tr("copy.c445"),
  };
  const capabilities = useCapabilities();
  const { vacancy, error: contextError } = useVacancyContext();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [position, setPosition] = useState("");
  const [job, setJob] = useState("");
  const [facts, setFacts] = useState("");
  const [sections, setSections] = useState(Object.keys(blocks));
  const [ai, setAI] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    client
      .get("/user/profile")
      .then((r) => {
        setProfile(r.data.data);
        if (!new URLSearchParams(window.location.search).get("vacancy"))
          setPosition(r.data.data.desired_position || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (vacancy) {
      setTitle(
        `${vacancy.data.name} — ${vacancy.data.company_name}`.slice(0, 200),
      );
      setPosition(vacancy.data.name);
      setJob(vacancy.data.description);
    }
  }, [vacancy]);
  useEffect(() => {
    if (capabilities) setAI(capabilities.ai);
  }, [capabilities]);
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await client.post("/resume/create", {
        title,
        vacancy_id: vacancy?.id || null,
        position,
        job,
        facts,
        sections,
        use_ai: ai,
      });
      if (r.data.questions.length) setQuestions(r.data.questions);
      else navigate(`/resume/${r.data.resume.resume_id}/edit`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <h1 className="text-3xl font-bold">{tr("copy.c446")}</h1>
        <VacancyContext vacancy={vacancy} />
        {contextError && <p role="alert">{contextError}</p>}
        <p className="text-muted-foreground">{tr("copy.c447")}</p>
        <label className="block space-y-2">
          {tr("copy.c448")}
          <Input
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("copy.c449")}
          />
        </label>
        <label className="block space-y-2">
          {tr("copy.c059")}
          <Input
            value={position}
            maxLength={200}
            onChange={(e) => setPosition(e.target.value)}
          />
        </label>
        <label className="block space-y-2">
          {tr("copy.c157")}
          <Textarea
            aria-label={tr("copy.c157")}
            value={job}
            maxLength={15000}
            onChange={(e) => setJob(e.target.value)}
          />
        </label>
        <fieldset className="border rounded-lg p-4 space-y-3">
          <legend>{tr("copy.c450")}</legend>
          {Object.entries(blocks).map(([key, label]) => (
            <label className="flex gap-2" key={key}>
              <input
                type="checkbox"
                checked={sections.includes(key)}
                onChange={() =>
                  setSections(
                    sections.includes(key)
                      ? sections.filter((s) => s !== key)
                      : [...sections, key],
                  )
                }
              />
              {label}
              <span className="text-muted-foreground text-sm">
                {profile && sectionStatus(profile[key as keyof Profile])}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={ai}
            disabled={!capabilities?.ai}
            onChange={(e) => setAI(e.target.checked)}
          />
          {tr("copy.c453")}
        </label>
        {capabilities && !capabilities.ai && (
          <p className="text-sm text-muted-foreground">{tr("copy.c454")}</p>
        )}
        {questions.length > 0 && (
          <div role="status" className="rounded-lg bg-muted p-4">
            <h2 className="font-semibold">{tr("copy.c455")}</h2>
            <ol className="list-decimal pl-5">
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>
        )}
        {ai && (
          <label className="block space-y-2">
            {tr("copy.c456")}
            <Textarea
              value={facts}
              maxLength={10000}
              onChange={(e) => setFacts(e.target.value)}
              placeholder={tr("copy.c457")}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button
          disabled={busy || !title.trim() || (ai && !position.trim())}
          onClick={create}
        >
          {busy ? tr("copy.c458") : tr("copy.c459")}
        </Button>
      </div>
    </MainLayout>
  );
}
