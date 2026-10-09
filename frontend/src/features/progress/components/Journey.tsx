import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { Link } from "react-router-dom";
import { useOverview } from "@/features/dashboard/api";
export function Journey() {
  useLocale();
  const { data, error } = useOverview();
  if (error) return <p role="alert">{getErrorMessage(error)}</p>;
  if (!data) return <p role="status">{tr("copy.c035")}</p>;
  const quests = [
    {
      title: tr("copy.c036"),
      done: data.resumes > 0,
      reward: 10,
      link: "/resume",
    },
    {
      title: tr("copy.c037"),
      done: data.interviews_completed > 0,
      reward: 50,
      link: "/interview",
    },
    {
      title: tr("copy.c038"),
      done: data.completed_modules > 0,
      reward: 25,
      link: "/plan",
    },
  ];
  return (
    <section className="rounded-xl border p-6 space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-primary">{tr("copy.c039")}</p>
          <h2 className="text-3xl font-bold">
            {tr("copy.c040")} {data.level}
          </h2>
        </div>
        <p>
          {data.xp} {tr("copy.c041")} {data.streak} {tr("copy.c042")}
        </p>
      </div>
      <progress
        value={data.level_progress}
        max={100}
        className="w-full accent-primary"
        aria-label={tr("copy.c043")}
      />
      <p className="text-sm text-muted-foreground">
        {100 - data.level_progress} {tr("copy.c044")}
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        {quests.map((q) => (
          <Link
            to={q.link}
            key={q.title}
            className={`rounded-lg border p-4 space-y-2 ${q.done ? "bg-primary/10" : ""}`}
          >
            <p className="text-xs">
              {q.done ? tr("copy.c045") : tr("copy.c046")}
            </p>
            <h3 className="font-semibold">{q.title}</h3>
            <p>+{q.reward} XP</p>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{tr("copy.c047")}</p>
    </section>
  );
}
