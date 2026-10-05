import type { Profile } from "@/types/career";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
const blocks = {
  summary: "О себе",
  experience: "Опыт работы",
  education: "Образование",
  projects: "Проекты",
  skills: "Навыки",
  certificates: "Сертификаты",
  languages: "Языки",
};
import { useVacancyContext } from "@/hooks/useVacancyContext";
import { VacancyContext } from "@/components/VacancyContext";
import { useCapabilities } from "@/hooks/useCapabilities";
export default function ResumeCreate() {
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
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <h1 className="text-3xl font-bold">Новое резюме</h1>
        <VacancyContext vacancy={vacancy} />
        {contextError && <p role="alert">{contextError}</p>}
        <p className="text-muted-foreground">
          Выберите блоки профиля и целевую позицию. Черновик можно полностью
          отредактировать перед экспортом.
        </p>
        <label className="block space-y-2">
          Название резюме
          <Input
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Backend developer — компания"
          />
        </label>
        <label className="block space-y-2">
          Целевая позиция
          <Input
            value={position}
            maxLength={200}
            onChange={(e) => setPosition(e.target.value)}
          />
        </label>
        <label className="block space-y-2">
          Описание вакансии
          <Textarea
            aria-label="Описание вакансии"
            value={job}
            maxLength={15000}
            onChange={(e) => setJob(e.target.value)}
          />
        </label>
        <fieldset className="border rounded-lg p-4 space-y-3">
          <legend>Добавить блоки из профиля</legend>
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
                {profile &&
                  (Array.isArray(profile[key])
                    ? `${profile[key].length} записей`
                    : profile[key]
                      ? "Заполнено"
                      : "Пока пусто")}
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
          Собрать и адаптировать с ИИ
        </label>
        {capabilities && !capabilities.ai && (
          <p className="text-sm text-muted-foreground">
            Сейчас доступна сборка из выбранных блоков профиля. Готовый черновик
            можно редактировать и экспортировать.
          </p>
        )}
        {questions.length > 0 && (
          <div role="status" className="rounded-lg bg-muted p-4">
            <h2 className="font-semibold">Нужно уточнить факты</h2>
            <ol className="list-decimal pl-5">
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>
        )}
        {ai && (
          <label className="block space-y-2">
            Дополнительные факты и ответы на вопросы
            <Textarea
              value={facts}
              maxLength={10000}
              onChange={(e) => setFacts(e.target.value)}
              placeholder="Опишите реальный опыт и достижения"
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
          {busy ? "Собираем черновик…" : "Создать черновик"}
        </Button>
      </div>
    </MainLayout>
  );
}
