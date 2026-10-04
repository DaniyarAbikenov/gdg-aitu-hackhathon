import type { OverviewData } from "@/types/product";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "@/api/client";
export function Journey() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    client
      .get("/overview", { params: { offset: -new Date().getTimezoneOffset() } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Загрузка пути…</p>;
  const quests = [
    {
      title: "Создайте первое резюме",
      done: data.resumes > 0,
      reward: 10,
      link: "/resume",
    },
    {
      title: "Пройдите интервью",
      done: data.interviews_completed > 0,
      reward: 50,
      link: "/interview",
    },
    {
      title: "Завершите учебное задание",
      done: data.completed_modules > 0,
      reward: 25,
      link: "/plan",
    },
  ];
  return (
    <section className="rounded-xl border p-6 space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-primary">Ваш путь к трудоустройству</p>
          <h2 className="text-3xl font-bold">Уровень {data.level}</h2>
        </div>
        <p>
          {data.xp} XP · Серия активности: {data.streak} дн.
        </p>
      </div>
      <progress
        value={data.level_progress}
        max={100}
        className="w-full accent-primary"
        aria-label="Опыт до следующего уровня"
      />
      <p className="text-sm text-muted-foreground">
        {100 - data.level_progress} XP до следующего уровня. Повторное
        переключение выполненного задания не приносит дополнительные очки.
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        {quests.map((q) => (
          <Link
            to={q.link}
            key={q.title}
            className={`rounded-lg border p-4 space-y-2 ${q.done ? "bg-primary/10" : ""}`}
          >
            <p className="text-xs">
              {q.done ? "✓ Выполнено" : "Следующее задание"}
            </p>
            <h3 className="font-semibold">{q.title}</h3>
            <p>+{q.reward} XP</p>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Уровень отражает активность подготовки, а не вероятность получения
        оффера. Опыт начисляется за действия после включения журнала активности.
      </p>
    </section>
  );
}
