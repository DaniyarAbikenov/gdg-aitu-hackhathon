import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import type { ProfileData } from "@/api/types";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/features/profile/api";
import { useCreateResume } from "../api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useVacancyContext } from "@/features/applications/useVacancyContext";
import { VacancyContext } from "@/features/applications/components/VacancyContext";
import { useCapabilities } from "@/api/system";
import { describe } from "../profileValues";

/** The selectable entries of a profile section: [key, label] pairs. */
function entriesOf(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  const result: [string, string][] = [];
  for (const item of value) {
    if (typeof item === "string") result.push([item, item]);
    else if (item && typeof item === "object" && "id" in item && item.id)
      result.push([String(item.id), describe(item).slice(0, 140)]);
    else return []; // Entries saved before ids existed are chosen as a whole section.
  }
  return result;
}

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
    awards: tr("linked.awards"),
    skills: tr("copy.c104"),
    certificates: tr("copy.c444"),
    languages: tr("copy.c445"),
    interests: tr("linked.interests"),
  };
  const capabilities = useCapabilities();
  const { vacancy, error: contextError } = useVacancyContext();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [position, setPosition] = useState("");
  const [job, setJob] = useState("");
  const [facts, setFacts] = useState("");
  const [sections, setSections] = useState(
    Object.keys(blocks).filter((key) => key !== "interests"),
  );
  // Entries the candidate left out, per section; everything else is included.
  const [excluded, setExcluded] = useState<Record<string, string[]>>({});
  const [ai, setAI] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const profileQuery = useProfile();
  const createResume = useCreateResume();
  const profile = profileQuery.data?.data ?? null;
  const shownError =
    error || (profileQuery.error ? getErrorMessage(profileQuery.error) : "");
  const seeded = useRef(false);
  useEffect(() => {
    if (!profile || seeded.current) return;
    seeded.current = true;
    if (!new URLSearchParams(window.location.search).get("vacancy"))
      setPosition(profile.desired_position || "");
  }, [profile]);
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
      const created = await createResume.mutateAsync({
        title,
        vacancy_id: vacancy?.id || null,
        position,
        job,
        facts,
        sections,
        selection: Object.fromEntries(
          sections
            .map(
              (key) =>
                [key, entriesOf(profile?.[key as keyof ProfileData])] as const,
            )
            .filter(([, entries]) => entries.length > 0)
            .map(([key, entries]) => [
              key,
              entries
                .map(([id]) => id)
                .filter((id) => !(excluded[key] ?? []).includes(id)),
            ]),
        ),
        use_ai: ai,
      });
      if (created.questions.length) setQuestions(created.questions);
      else navigate(`/resume/${created.resume.resume_id}/edit`);
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
          <p className="text-sm text-muted-foreground">
            {tr("linked.chooseExplain")}
          </p>
          {Object.entries(blocks).map(([key, label]) => {
            const value = profile?.[key as keyof ProfileData];
            const entries = entriesOf(value);
            const left = excluded[key] ?? [];
            return (
              <div key={key} className="space-y-2">
                <label className="flex gap-2">
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
                    {profile && sectionStatus(value)}
                  </span>
                </label>
                {sections.includes(key) && entries.length > 1 && (
                  <ul
                    aria-label={tr("linked.entriesOf", { section: label })}
                    className="ml-6 space-y-1 text-sm"
                  >
                    {entries.map(([id, text]) => (
                      <li key={id}>
                        <label className="flex gap-2 break-words">
                          <input
                            type="checkbox"
                            checked={!left.includes(id)}
                            onChange={() =>
                              setExcluded({
                                ...excluded,
                                [key]: left.includes(id)
                                  ? left.filter((v) => v !== id)
                                  : [...left, id],
                              })
                            }
                          />
                          <span className="min-w-0">{text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
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
        {shownError && (
          <p role="alert" className="text-destructive">
            {shownError}
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
