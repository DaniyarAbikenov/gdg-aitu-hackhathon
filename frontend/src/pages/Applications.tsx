import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BriefcaseBusiness, ArrowRight, Plus } from "lucide-react";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SkillPicker } from "@/components/SkillPicker";
import type { ResumeRecord } from "@/api/resume";
import type { ApplicationRecord, ApplicationFields } from "@/types/product";
const stages = {
  saved: "Сохранена",
  preparing: "Готовлюсь",
  applied: "Отклик отправлен",
  interview: "Интервью назначено",
  offer: "Получен оффер",
  rejected: "Отказ",
  archived: "Архив",
};
const empty: ApplicationFields = {
  name: "",
  company_name: "",
  company_description: "",
  description: "",
  skills: [],
  status: "saved",
  source_url: "",
  resume_id: "",
  company_id: "",
  notes: "",
  next_action: "",
  follow_up: "",
};
export default function Applications() {
  const [params, setParams] = useSearchParams();
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [draft, setDraft] = useState<ApplicationFields | null>(null);
  const [editing, setEditing] = useState<ApplicationRecord | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active");
  const load = async () => {
    const [a, r] = await Promise.all([
      client.get("/applications"),
      client.get("/resume"),
    ]);
    setRecords(a.data);
    setResumes(r.data);
  };
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const selected = records.find((r) => r.id === params.get("id"));
  const change = (key: keyof ApplicationFields, value: string | string[]) =>
    setDraft((d) => ({ ...d!, [key]: value }));
  const edit = (record: ApplicationRecord | null) => {
    setEditing(record);
    setDraft(record ? { ...empty, ...record.data } : { ...empty });
    setError("");
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const data = {
        ...draft,
        revision: editing?.revision || 0,
        source_url: draft.source_url || null,
        resume_id: draft.resume_id || null,
        company_id: draft.company_id || null,
        follow_up: draft.follow_up || null,
      };
      // Only editable fields cross the boundary; server-derived context stays server-side.
      const payload = Object.fromEntries(
        Object.keys({ ...empty, revision: 0 }).map((k) => [k, data[k]]),
      );
      const r = editing
        ? await client.put(`/applications/${editing.id}`, payload)
        : await client.post("/applications", payload);
      await load();
      setParams({ id: r.data.id });
      setDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const visible = records.filter(
    (r) =>
      (filter === "all" ||
        (filter === "active"
          ? !["archived", "rejected", "offer"].includes(r.data.status)
          : r.data.status === filter)) &&
      `${r.data.name} ${r.data.company_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Мои вакансии</h1>
            <p className="text-muted-foreground mt-2">
              Одна вакансия — резюме, тренировки и следующий шаг в одном месте.
            </p>
          </div>
          <Button onClick={() => edit(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить вакансию
          </Button>
        </header>
        {error && (
          <p role="alert" className="text-destructive">
            {error}{" "}
            <Button
              variant="link"
              onClick={() =>
                load()
                  .then(() => setError(""))
                  .catch((e) => setError(e.message))
              }
            >
              Обновить данные
            </Button>
          </p>
        )}
        {draft ? (
          <form
            onSubmit={save}
            className="border rounded-xl p-5 space-y-4"
            aria-label="Редактор вакансии"
          >
            <h2 className="text-xl font-semibold">
              {editing ? "Изменить вакансию" : "Новая вакансия"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ["name", "Название позиции"],
                ["company_name", "Компания"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Input
                    required
                    minLength={key === "company_name" ? 2 : 3}
                    maxLength={200}
                    value={draft[key] || ""}
                    onChange={(e) =>
                      change(key as keyof ApplicationFields, e.target.value)
                    }
                  />
                </label>
              ))}
            </div>
            <label className="block">
              Описание вакансии
              <Textarea
                aria-label="Описание вакансии"
                required
                minLength={10}
                maxLength={10000}
                rows={5}
                value={draft.description}
                onChange={(e) => change("description", e.target.value)}
              />
            </label>
            <label className="block">
              Ссылка на источник
              <Input
                type="url"
                placeholder="https://…"
                value={draft.source_url || ""}
                onChange={(e) => change("source_url", e.target.value)}
              />
            </label>
            <p className="font-medium">Технологии для подготовки</p>
            <SkillPicker
              placeholder="Найти технологию"
              selected={draft.skills}
              onChange={(v) => change("skills", v)}
            />
            <div className="flex flex-wrap gap-2">
              {draft.skills.map((s) => (
                <Button
                  type="button"
                  key={s}
                  variant="secondary"
                  onClick={() =>
                    change(
                      "skills",
                      draft.skills.filter((v) => v !== s),
                    )
                  }
                >
                  {s} ×
                </Button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                Статус отклика
                <select
                  aria-label="Статус отклика"
                  className="block w-full p-2 border rounded bg-background"
                  value={draft.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {Object.entries(stages).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Резюме для вакансии
                <select
                  aria-label="Резюме для вакансии"
                  className="block w-full p-2 border rounded bg-background"
                  value={draft.resume_id || ""}
                  onChange={(e) => change("resume_id", e.target.value)}
                >
                  <option value="">Пока не выбрано</option>
                  {resumes.map((r) => (
                    <option key={r.resume_id} value={r.resume_id}>
                      {r.title || r.filename}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                Следующее действие
                <Input
                  maxLength={500}
                  placeholder="Например: написать рекрутеру"
                  value={draft.next_action}
                  onChange={(e) => change("next_action", e.target.value)}
                />
              </label>
              <label>
                Дата следующего контакта
                <Input
                  type="date"
                  value={draft.follow_up || ""}
                  onChange={(e) => change("follow_up", e.target.value)}
                />
              </label>
            </div>
            <label className="block">
              Личные заметки
              <Textarea
                maxLength={5000}
                value={draft.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
            <p className="text-sm text-muted-foreground">
              Даты видны здесь и в обзоре. Сервис не отправляет отклики или
              письма автоматически.
            </p>
            <div className="flex gap-3">
              <Button disabled={busy}>
                {busy ? "Сохраняем…" : "Сохранить вакансию"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Отмена
              </Button>
            </div>
          </form>
        ) : null}
        {selected && !draft ? (
          <section
            aria-label="Подготовка к вакансии"
            className="border border-primary/30 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selected.data.company_name} · {stages[selected.data.status]}
                </p>
                <h2 className="text-2xl font-semibold">{selected.data.name}</h2>
              </div>
              <Button variant="outline" onClick={() => edit(selected)}>
                Изменить вакансию
              </Button>
            </div>
            <div className="rounded-lg bg-primary/5 p-4">
              <p className="font-semibold">Следующий шаг</p>
              <p>{selected.next_step}</p>
              {selected.data.follow_up && (
                <p className="mt-2 text-sm">
                  Контакт: {selected.data.follow_up}
                  {selected.data.follow_up < localDate ? " · дата прошла" : ""}
                </p>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words">
              {selected.data.description}
            </p>
            {selected.data.source_url && (
              <a
                href={selected.data.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Открыть исходную вакансию ↗
              </a>
            )}
            {selected.resume_title && (
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to={`/resume/${selected.data.resume_id}/edit`}>
                    Редактировать резюме
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/resume/${selected.data.resume_id}/generate`}>
                    Экспорт PDF / Word
                  </Link>
                </Button>
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  title: "1. Резюме",
                  body:
                    selected.resume_title ||
                    "Создайте резюме из фактов профиля. Оно прикрепится к этой вакансии.",
                  to: selected.resume_title
                    ? `/resume/${selected.data.resume_id}/improve?vacancy=${selected.id}`
                    : `/resume/new?vacancy=${selected.id}`,
                  action: selected.resume_title
                    ? "Адаптировать резюме"
                    : "Собрать резюме",
                },
                {
                  title: "2. Практика",
                  body: `Тренировок: ${selected.interviews.length}. Контекст вакансии будет заполнен заранее.`,
                  to: `/interview/start?vacancy=${selected.id}`,
                  action: "Начать тренировку",
                },
                {
                  title: "3. Обучение",
                  body: "План учитывает требования вакансии и результаты последней завершённой тренировки.",
                  to: `/plan?vacancy=${selected.id}`,
                  action: "Создать план",
                },
              ].map((x) => (
                <article
                  key={x.title}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <h3 className="font-semibold">{x.title}</h3>
                  <p className="text-sm text-muted-foreground">{x.body}</p>
                  <Link
                    className="inline-flex items-center gap-2 text-primary underline"
                    to={x.to}
                  >
                    {x.action}
                    <ArrowRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
            {selected.interviews.length > 0 && (
              <div>
                <h3 className="font-semibold">Тренировки по этой вакансии</h3>
                {selected.interviews.map((i, n) => (
                  <Link
                    key={i.id}
                    className="block text-primary underline py-1"
                    to={`/interview/${i.finished ? "summary" : i.mode === "voice" ? "voice" : "session"}?id=${i.id}`}
                  >
                    Тренировка {selected.interviews.length - n} ·{" "}
                    {i.finished
                      ? `${i.score}/100 — учебная оценка`
                      : "Продолжить"}
                  </Link>
                ))}
              </div>
            )}
            {selected.plans.map((p) => (
              <Link
                key={p.id}
                className="block text-primary underline"
                to={`/plan/${p.id}`}
              >
                Учебный план: {p.goal}
              </Link>
            ))}
            {selected.data.notes && (
              <div>
                <h3 className="font-semibold">Заметки</h3>
                <p className="whitespace-pre-wrap break-words">
                  {selected.data.notes}
                </p>
              </div>
            )}
          </section>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Input
            aria-label="Поиск вакансии"
            className="sm:max-w-sm"
            placeholder="Позиция или компания"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Фильтр вакансий"
            className="border rounded p-2 bg-background"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="active">В работе</option>
            <option value="all">Все</option>
            {Object.entries(stages).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p role="status">Загрузка вакансий…</p>
        ) : visible.length === 0 ? (
          <section className="border border-dashed rounded-xl p-8 text-center space-y-3">
            <BriefcaseBusiness className="mx-auto h-9 w-9 text-primary" />
            <h2 className="text-xl font-semibold">
              {records.length
                ? "Ничего не найдено"
                : "Начните с одной реальной вакансии"}
            </h2>
            <p className="text-muted-foreground">
              Сохраните требования, чтобы подготовка была конкретной.
            </p>
            <Button variant="outline" onClick={() => edit(null)}>
              Добавить первую вакансию
            </Button>
          </section>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {visible.map((r) => (
              <button
                key={r.id}
                className={`text-left border rounded-xl p-5 space-y-2 hover:border-primary ${selected?.id === r.id ? "border-primary" : ""}`}
                onClick={() => {
                  setParams({ id: r.id });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <div className="text-sm text-muted-foreground">
                  {r.data.company_name} · {stages[r.data.status]}
                </div>
                <h2 className="font-semibold text-lg break-words">
                  {r.data.name}
                </h2>
                <p className="text-sm">{r.next_step}</p>
                {r.data.follow_up && (
                  <p className="text-sm text-primary">
                    Следующий контакт: {r.data.follow_up}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
