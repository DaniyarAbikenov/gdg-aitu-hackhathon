import type { OverviewData } from "@/types/product";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const labels = {
  resumes: "Резюме",
  skills: "Навыки для развития",
  companies: "Компании и интервью",
  learning: "Обучение за неделю",
  activity: "Активность за 14 дней",
  journey: "Путь к трудоустройству",
};
export default function Dashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [prefs, setPrefs] = useState({
    revision: 0,
    data: { widgets: Object.keys(labels) },
  });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    Promise.all([
      client.get("/overview", {
        params: { offset: -new Date().getTimezoneOffset() },
      }),
      client.get("/preferences"),
    ])
      .then(([summary, preferences]) => {
        setData(summary.data);
        setPrefs(preferences.data);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);
  const toggle = async (key: string) => {
    setBusy(true);
    try {
      const widgets = prefs.data.widgets.includes(key)
        ? prefs.data.widgets.filter((k) => k !== key)
        : [...prefs.data.widgets, key];
      setPrefs({ ...prefs, data: { widgets } });
      const r = await client.put("/preferences", {
        widgets,
        revision: prefs.revision,
      });
      setPrefs(r.data);
    } catch (e) {
      setPrefs(prefs);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Обзор подготовки</h1>
            {data?.goal && <p className="text-primary mt-2">{data.goal}</p>}
            <p className="text-muted-foreground mt-2">
              Резюме, практика и обучение — ваш следующий шаг к работе.
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            Настроить виджеты
          </Button>
        </header>
        {editing && (
          <fieldset className="flex flex-wrap gap-4 rounded-lg border p-4">
            <legend>Что показывать</legend>
            {Object.entries(labels).map(([key, label]) => (
              <label key={key} className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={prefs.data.widgets.includes(key)}
                  onChange={() => toggle(key)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <div role="alert">
            {error}{" "}
            <Button variant="link" onClick={load}>
              Повторить
            </Button>
          </div>
        )}
        {!data && !error && <p role="status">Загрузка аналитики…</p>}
        {data && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {prefs.data.widgets.map((key) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle>{labels[key]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {key === "resumes" && (
                    <>
                      <p className="text-4xl font-bold">{data.resumes}</p>
                      <p>
                        Проанализировано: {data.reviewed_resumes} · Версий:{" "}
                        {data.resume_versions}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Актуальных: {data.active_resumes} · В архиве:{" "}
                        {data.archived_resumes}
                      </p>
                      <Link className="text-primary underline" to="/resume">
                        Управлять резюме
                      </Link>
                    </>
                  )}
                  {key === "skills" && (
                    <>
                      {data.skill_gaps.length ? (
                        data.skill_gaps.map((g) => (
                          <div key={g.name} className="flex justify-between">
                            <span>{g.name}</span>
                            <span>{g.mentions} вакансий</span>
                          </div>
                        ))
                      ) : (
                        <p>
                          Пока нет выявленных пробелов. Проанализируйте резюме
                          под вакансию.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Навыки из вакансий, не указанные в резюме. Это не оценка
                        уровня владения.
                      </p>
                    </>
                  )}
                  {key === "companies" && (
                    <>
                      <p>
                        Завершено интервью:{" "}
                        <strong>{data.interviews_completed}</strong>
                      </p>
                      <p>Средний результат: {data.average_score ?? "—"}/100</p>
                      {data.companies.length ? (
                        <ul className="space-y-1">
                          {data.companies.map((c) => (
                            <li key={c} className="break-words">
                              {c}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">
                          Начните первую тренировку.
                        </p>
                      )}
                      <Link className="text-primary underline" to="/interview">
                        История и новое интервью
                      </Link>
                    </>
                  )}
                  {key === "learning" && (
                    <>
                      <p className="text-4xl font-bold">
                        {data.week.learning_current}
                      </p>
                      <p>Заданий впервые завершено на этой неделе</p>
                      <p className="text-sm text-muted-foreground">
                        Прошлая неделя: {data.week.learning_previous} ·
                        Изменение:{" "}
                        {data.week.learning_current -
                          data.week.learning_previous >
                        0
                          ? "+"
                          : ""}
                        {data.week.learning_current -
                          data.week.learning_previous}
                      </p>
                      <p>
                        {data.completed_modules} / {data.total_modules} модулей
                        выполнено
                      </p>
                      <Link className="text-primary underline" to="/plan">
                        Учебные планы
                      </Link>
                    </>
                  )}
                  {key === "activity" && (
                    <>
                      <div
                        className="flex gap-1 h-28 items-end"
                        aria-label="Действия за последние 14 дней"
                      >
                        {data.activity.map((d) => (
                          <div
                            key={d.date}
                            title={`${d.date}: ${d.count}`}
                            className="flex-1 bg-primary/70 rounded-t min-h-1"
                            style={{
                              height: `${Math.max(3, (d.count / Math.max(1, ...data.activity.map((a) => a.count))) * 100)}%`,
                            }}
                          />
                        ))}
                      </div>
                      <p>
                        Эта неделя: {data.week.current} · Прошлая:{" "}
                        {data.week.previous}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Неделя начинается в понедельник, по вашему часовому
                        поясу. История учитывается с{" "}
                        {data.tracking_started
                          ? new Date(data.tracking_started).toLocaleDateString()
                          : "первого действия"}
                        .
                      </p>
                    </>
                  )}
                  {key === "journey" && (
                    <>
                      <p className="text-3xl font-bold">Уровень {data.level}</p>
                      <p>
                        {data.xp} XP · Серия: {data.streak} дн.
                      </p>
                      <progress
                        className="w-full accent-primary"
                        max={100}
                        value={data.level_progress}
                        aria-label="Прогресс уровня"
                      />
                      <p className="text-sm">
                        До следующего уровня: {100 - data.level_progress} XP
                      </p>
                      <Link className="text-primary underline" to="/progress">
                        Задания и достижения
                      </Link>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!prefs.data.widgets.length && (
          <p>Виджеты скрыты. Добавьте нужные через «Настроить виджеты».</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/resume/new">Создать резюме</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/plan">Создать план</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/onboarding">Обновить профиль</Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
