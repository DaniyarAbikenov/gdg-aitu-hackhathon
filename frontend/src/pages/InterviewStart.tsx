import type { TargetRecord } from "@/types/product";
import type { InterviewRecord } from "@/api/interview";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SkillPicker } from "@/components/SkillPicker";
import i18n from "@/i18n/config";
import { useVacancyContext } from "@/hooks/useVacancyContext";
import { VacancyContext } from "@/components/VacancyContext";
import { useCapabilities } from "@/hooks/useCapabilities";
export default function InterviewStart() {
  const capabilities = useCapabilities();
  const { vacancy, error: contextError } = useVacancyContext();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<TargetRecord[]>([]);
  const [vacancies, setVacancies] = useState<TargetRecord[]>([]);
  const [history, setHistory] = useState<InterviewRecord[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [job, setJob] = useState("");
  const [stack, setStack] = useState<string[]>([]);
  const [modes, setModes] = useState(["theoretical"]);
  const [mode, setMode] = useState("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    Promise.all([
      client.get("/targets/company"),
      client.get("/targets/vacancy"),
      client.get("/interview"),
    ])
      .then(([c, v, h]) => {
        setCompanies(c.data);
        setVacancies(v.data);
        setHistory(h.data);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (vacancy) {
      setVacancyId(vacancy.id);
      setCompanyId(vacancy.data.company_id || "");
      setCompanyName(vacancy.data.company_name);
      setCompany(vacancy.data.company_description || vacancy.data.company_name);
      setTitle(vacancy.data.name);
      setJob(vacancy.data.description);
      setStack(vacancy.data.skills);
    }
  }, [vacancy]);
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      let c = companyId;
      let v = vacancyId;
      if (!c) {
        const r = await client.post("/targets/company", {
          name: companyName,
          description: company,
        });
        c = r.data.id;
        setCompanyId(c);
        setCompanies([...companies, r.data]);
      }
      if (!v) {
        const r = await client.post("/targets/vacancy", {
          name: title,
          description: job,
          company_id: c,
          skills: stack,
        });
        v = r.data.id;
        setVacancyId(v);
        setVacancies([...vacancies, r.data]);
      }
      const r = await client.post("/interview/start", {
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
        language: i18n.language === "kz" ? "kk" : i18n.language,
      });
      navigate(
        `/interview/${mode === "voice" ? "voice" : "session"}?id=${r.data.id}`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Интервью</h1>
        <VacancyContext vacancy={vacancy} />
        {contextError && <p role="alert">{contextError}</p>}
        <p className="text-muted-foreground">
          Тренируйтесь под конкретную компанию и вакансию. Возвращайтесь к
          ответам и отслеживайте результат.
        </p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {capabilities && !capabilities.ai && (
          <p className="text-sm text-muted-foreground">
            Тренировки с ИИ сейчас недоступны. Вы можете сохранить вакансию и
            подготовить резюме в разделе «Вакансии».
          </p>
        )}
        <section className="border rounded-xl p-5 space-y-4">
          <h2 className="text-xl font-semibold">Новая тренировка</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              Сохранённая компания
              <select
                className="w-full border rounded p-2 bg-background"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setVacancyId("");
                  const c = companies.find((c) => c.id === e.target.value);
                  setCompanyName(c?.data.name || "");
                  setCompany(c?.data.description || "");
                }}
              >
                <option value="">Новая компания</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.data.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              Сохранённая вакансия
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
                <option value="">Новая вакансия</option>
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
          <label className="block">
            Название компании
            <Input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setCompanyId("");
              }}
            />
          </label>
          <label className="block">
            О компании
            <Textarea
              aria-label="О компании"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                setCompanyId("");
              }}
            />
          </label>
          <label className="block">
            Название вакансии
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setVacancyId("");
              }}
            />
          </label>
          <label className="block">
            Описание вакансии
            <Textarea
              aria-label="Описание вакансии"
              value={job}
              onChange={(e) => {
                setJob(e.target.value);
                setVacancyId("");
              }}
            />
          </label>
          <p>Стек для интервью</p>
          <SkillPicker
            selected={stack}
            onChange={setStack}
            placeholder="Найти навык"
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
            <legend>Тип вопросов — можно выбрать оба</legend>
            {[
              ["theoretical", "Теория"],
              ["practical", "Практика"],
            ].map(([key, label]) => (
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
            <legend>Формат разговора</legend>
            {[
              ["text", "Текст и микрофон"],
              ["voice", "Живой голосовой диалог"],
            ].map(([key, label]) => (
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
            {busy ? "Подготовка…" : "Начать интервью"}
          </Button>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">История интервью</h2>
          <Input
            aria-label="Поиск интервью"
            placeholder="Компания или вакансия"
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
                  {new Date(h.created_at).toLocaleString()} ·{" "}
                  {h.context.mode === "voice" ? "Голос" : "Текст"} ·{" "}
                  {h.finished ? `Завершено: ${h.score}/100` : "Продолжить"}
                </p>
                <p className="text-sm">
                  Ответов: {h.answers.length} · {h.context.tech_stack}
                </p>
              </Link>
            ))}
          {!history.length && (
            <p>
              Первые тренировки появятся здесь. Незавершённое интервью можно
              продолжить позже.
            </p>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
