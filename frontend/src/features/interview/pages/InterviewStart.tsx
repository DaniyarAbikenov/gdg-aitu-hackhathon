import { tr, useLocale, displayLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import type { InterviewView } from "@/api/types";
import type { TargetRecord } from "@/features/applications/types";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCreateTarget, useTargets } from "@/features/applications/api";
import { useInterviews, useStartInterview } from "../api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SkillPicker } from "@/components/SkillPicker";
import { useVacancyContext } from "@/features/applications/useVacancyContext";
import { VacancyContext } from "@/features/applications/components/VacancyContext";
import { useCapabilities } from "@/api/system";
const none = {
  targets: [] as TargetRecord[],
  interviews: [] as InterviewView[],
};
type Style = "theoretical" | "practical";
export default function InterviewStart() {
  useLocale();
  const [params] = useSearchParams();
  const capabilities = useCapabilities();
  const { vacancy, error: contextError } = useVacancyContext();
  const navigate = useNavigate();
  const companiesQuery = useTargets("company");
  const vacanciesQuery = useTargets("vacancy");
  const historyQuery = useInterviews();
  const createTarget = useCreateTarget();
  const startInterview = useStartInterview();
  const companies = companiesQuery.data ?? none.targets;
  const vacancies = vacanciesQuery.data ?? none.targets;
  const history = historyQuery.data ?? none.interviews;
  const [companyId, setCompanyId] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [job, setJob] = useState("");
  const [stack, setStack] = useState<string[]>([]);
  const [modes, setModes] = useState<Style[]>(["theoretical"]);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [busy, setBusy] = useState(false);
  const [startError, setError] = useState("");
  const loadFailure =
    companiesQuery.error ?? vacanciesQuery.error ?? historyQuery.error;
  const error = startError || (loadFailure ? getErrorMessage(loadFailure) : "");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    if (vacancy) {
      setVacancyId(vacancy.id);
      setCompanyId(vacancy.data.company_id || "");
      setCompanyName(vacancy.data.company_name);
      setCompany(vacancy.data.company_description || vacancy.data.company_name);
      setTitle(vacancy.data.name);
      setJob(vacancy.data.description);
      setStack(vacancy.data.skills ?? []);
    }
  }, [vacancy]);
  useEffect(() => {
    const c = companies.find((c) => c.id === params.get("company"));
    if (c) {
      setCompanyId(c.id);
      setCompanyName(c.data.name);
      setCompany(c.data.description || c.data.name);
      setStack(c.data.skills || []);
    }
  }, [companies, params]);
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      let c = companyId;
      let v = vacancyId;
      if (!c) {
        const target = await createTarget.mutateAsync({
          kind: "company",
          name: companyName,
          description: company,
        });
        c = target.id;
        setCompanyId(c);
      }
      if (!v) {
        const target = await createTarget.mutateAsync({
          kind: "vacancy",
          name: title,
          description: job,
          company_id: c,
          skills: stack,
        });
        v = target.id;
        setVacancyId(v);
      }
      const record = await startInterview.mutateAsync({
        company_id: c,
        vacancy_id: v,
        company_name: companyName,
        vacancy_title: title,
        company_description: company || companyName,
        job_description: job,
        tech_stack: stack.join(", "),
        style: modes.length === 2 ? "mixed" : modes[0],
        modes,
        mode,
      });
      navigate(
        `/interview/${mode === "voice" ? "voice" : "session"}?id=${record.id}`,
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">{tr("copy.c322")}</h1>
        <VacancyContext vacancy={vacancy} />
        {contextError && <p role="alert">{contextError}</p>}
        <p className="text-muted-foreground">{tr("copy.c323")}</p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {capabilities && !capabilities.ai && (
          <p className="text-sm text-muted-foreground">{tr("copy.c324")}</p>
        )}
        <section className="border rounded-xl p-5 space-y-4">
          <h2 className="text-xl font-semibold">{tr("copy.c325")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              {tr("copy.c326")}
              <select
                className="w-full border rounded p-2 bg-background"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setVacancyId("");
                  const c = companies.find((c) => c.id === e.target.value);
                  setCompanyName(c?.data.name || "");
                  setCompany(c?.data.description || "");
                  setStack(c?.data.skills || []);
                }}
              >
                <option value="">{tr("copy.c156")}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.data.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              {tr("copy.c327")}
              <select
                className="w-full border rounded p-2 bg-background"
                value={vacancyId}
                onChange={(e) => {
                  setVacancyId(e.target.value);
                  const v = vacancies.find((v) => v.id === e.target.value);
                  setTitle(v?.data.name || "");
                  setJob(v?.data.description || "");
                  setStack(v?.data.skills || []);
                }}
              >
                <option value="">{tr("copy.c154")}</option>
                {vacancies
                  .filter((v) => !companyId || v.data.company_id === companyId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.data.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <Link
            className="text-primary underline"
            to={companyId ? `/companies?id=${companyId}` : "/companies"}
          >
            {tr("copy.c328")}
          </Link>
          <label className="block">
            {tr("copy.c210")}
            <Input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setCompanyId("");
              }}
            />
          </label>
          <label className="block">
            {tr("copy.c212")}
            <Textarea
              aria-label={tr("copy.c212")}
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                setCompanyId("");
              }}
            />
          </label>
          <label className="block">
            {tr("copy.c329")}
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setVacancyId("");
              }}
            />
          </label>
          <label className="block">
            {tr("copy.c157")}
            <Textarea
              aria-label={tr("copy.c157")}
              value={job}
              onChange={(e) => {
                setJob(e.target.value);
                setVacancyId("");
              }}
            />
          </label>
          <p>{tr("copy.c330")}</p>
          <SkillPicker
            selected={stack}
            onChange={setStack}
            placeholder={tr("copy.c331")}
          />
          <div className="flex flex-wrap gap-2">
            {stack.map((s) => (
              <Button
                key={s}
                variant="secondary"
                onClick={() => setStack(stack.filter((v) => v !== s))}
              >
                {s} ×
              </Button>
            ))}
          </div>
          <fieldset className="flex flex-wrap gap-4">
            <legend>{tr("copy.c332")}</legend>
            {(
              [
                ["theoretical", tr("copy.c333")],
                ["practical", tr("copy.c334")],
              ] as const
            ).map(([key, label]) => (
              <label className="flex gap-2" key={key}>
                <input
                  type="checkbox"
                  checked={modes.includes(key)}
                  onChange={() =>
                    setModes(
                      modes.includes(key)
                        ? modes.filter((m) => m !== key)
                        : [...modes, key],
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-wrap gap-4">
            <legend>{tr("copy.c335")}</legend>
            {(
              [
                ["text", tr("copy.c336")],
                ["voice", tr("copy.c337")],
              ] as const
            ).map(([key, label]) => (
              <label className="flex gap-2" key={key}>
                <input
                  type="radio"
                  name="interview-mode"
                  checked={mode === key}
                  onChange={() => setMode(key)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <Button
            disabled={
              !capabilities?.ai ||
              (mode === "voice" && !capabilities?.voice) ||
              busy ||
              companyName.trim().length < 3 ||
              !title.trim() ||
              job.trim().length < 10 ||
              !stack.length ||
              !modes.length
            }
            onClick={start}
          >
            {busy ? tr("copy.c338") : tr("copy.c339")}
          </Button>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{tr("copy.c340")}</h2>
          <Input
            aria-label={tr("copy.c341")}
            placeholder={tr("copy.c342")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {history
            .filter((h) =>
              JSON.stringify(h.context)
                .toLowerCase()
                .includes(filter.toLowerCase()),
            )
            .map((h) => (
              <Link
                className="block rounded-xl border p-4 space-y-1 hover:bg-muted/50"
                key={h.id}
                to={`/interview/${h.finished ? "summary" : h.context.mode === "voice" ? "voice" : "session"}?id=${h.id}`}
              >
                <h3 className="font-semibold">
                  {h.context.company_name || h.context.company_description} ·{" "}
                  {h.context.vacancy_title ||
                    h.context.job_description.slice(0, 100)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(h.created_at).toLocaleString(displayLocale())} ·{" "}
                  {h.context.mode === "voice"
                    ? tr("copy.c343")
                    : tr("copy.c344")}{" "}
                  ·{" "}
                  {h.finished
                    ? tr("dynamic.completed", { score: h.score })
                    : tr("copy.c191")}
                </p>
                <p className="text-sm">
                  {tr("copy.c345")} {h.answers.length} · {h.context.tech_stack}
                </p>
              </Link>
            ))}
          {!history.length && <p>{tr("copy.c346")}</p>}
        </section>
      </div>
    </MainLayout>
  );
}
