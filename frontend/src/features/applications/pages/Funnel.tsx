import type { Funnel as FunnelData, FunnelInsight } from "@/api/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { displayLocale, tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { Link } from "react-router-dom";
import { useFunnel } from "../api";

const EFFORT = ["applications", "practice", "modules"] as const;
const COLORS: Record<(typeof EFFORT)[number], string> = {
  applications: "bg-primary",
  practice: "bg-emerald-500",
  modules: "bg-amber-500",
};

function insightText(insight: FunnelInsight) {
  const params = { ...insight.params };
  if (insight.key === "pattern")
    params.reason = tr(`funnel.reasons.${params.reason}`);
  return tr(`funnel.insights.${insight.key}`, params);
}

function weekLabel(week: string) {
  return new Intl.DateTimeFormat(displayLocale(), {
    day: "numeric",
    month: "short",
  }).format(new Date(week));
}

function Stages({ data }: { data: FunnelData }) {
  const top = Math.max(data.stages[0]?.count ?? 0, 1);
  return (
    <section aria-labelledby="funnel-stages" className="space-y-3">
      <h2 id="funnel-stages" className="text-xl font-semibold">
        {tr("funnel.stagesTitle")}
      </h2>
      <ol className="space-y-3">
        {data.stages.map((s) => (
          <li key={s.stage} className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {tr(`funnel.stages.${s.stage}`)}: {s.count}
              </span>
              {s.rate !== null && (
                <span className="text-sm text-muted-foreground">
                  {tr("funnel.ofPrevious", {
                    rate: Math.round(s.rate * 100),
                  })}
                </span>
              )}
            </div>
            <div className="h-3 rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-3 rounded-full bg-primary"
                style={{ width: `${(s.count / top) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        {tr("funnel.active", { count: data.active })}
      </p>
    </section>
  );
}

function Rejections({ data }: { data: FunnelData }) {
  const r = data.rejections;
  return (
    <section
      aria-labelledby="funnel-rejections"
      className="rounded-xl border p-5 space-y-3"
    >
      <h2 id="funnel-rejections" className="text-xl font-semibold">
        {tr("funnel.rejectionsTitle")}: {r.total}
      </h2>
      {r.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tr("funnel.noRejections")}
        </p>
      ) : (
        <>
          <ul className="text-sm space-y-1">
            {r.by_stage.map((s) => (
              <li key={s.stage}>
                {tr(`funnel.rejectedAt.${s.stage}`)}: {s.count}
              </li>
            ))}
          </ul>
          {r.by_reason.length > 0 && (
            <div>
              <h3 className="font-medium text-sm">
                {tr("funnel.reasonsTitle")}
              </h3>
              <ul className="text-sm space-y-1">
                {r.by_reason.map((x) => (
                  <li key={x.reason}>
                    {tr(`funnel.reasons.${x.reason}`)}: {x.count}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.total > r.reviewed && (
            <Link className="text-sm text-primary underline" to="/applications">
              {tr("funnel.unreviewed", { count: r.total - r.reviewed })}
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function Effort({ data }: { data: FunnelData }) {
  const top = Math.max(
    1,
    ...data.effort.flatMap((w) => EFFORT.map((k) => w[k])),
  );
  return (
    <section
      aria-labelledby="funnel-effort"
      className="rounded-xl border p-5 space-y-3"
    >
      <div>
        <h2 id="funnel-effort" className="text-xl font-semibold">
          {tr("funnel.effortTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tr("funnel.effortHint")}
        </p>
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-8 gap-1 sm:gap-3 items-end h-36"
      >
        {data.effort.map((w) => (
          <div key={w.week} className="flex h-full flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-0.5">
              {EFFORT.map((k) => (
                <div
                  key={k}
                  title={`${tr(`funnel.effort.${k}`)}: ${w[k]}`}
                  className={`w-1.5 sm:w-3 rounded-t ${COLORS[k]}`}
                  style={{ height: `${(w[k] / top) * 100}%` }}
                />
              ))}
            </div>
            <span className="mt-1 text-center text-[10px] sm:text-xs text-muted-foreground">
              {weekLabel(w.week)}
            </span>
          </div>
        ))}
      </div>
      <ul className="flex flex-wrap gap-3 text-xs" aria-hidden="true">
        {EFFORT.map((k) => (
          <li key={k} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${COLORS[k]}`} />
            {tr(`funnel.effort.${k}`)}
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{tr("funnel.effortTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{tr("funnel.week")}</th>
            {EFFORT.map((k) => (
              <th key={k} scope="col">
                {tr(`funnel.effort.${k}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.effort.map((w) => (
            <tr key={w.week}>
              <th scope="row">
                {tr("funnel.weekOf", { date: weekLabel(w.week) })}
              </th>
              {EFFORT.map((k) => (
                <td key={k}>{w[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Funnel() {
  useLocale();
  const funnel = useFunnel();
  const data = funnel.data;
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{tr("funnel.title")}</h1>
          <p className="text-muted-foreground">{tr("funnel.intro")}</p>
        </header>
        {funnel.error && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(funnel.error)}
          </p>
        )}
        {data && data.total === 0 && (
          <div className="rounded-xl border p-5 space-y-3">
            <p>{tr("funnel.empty")}</p>
            <Button asChild>
              <Link to="/applications">{tr("funnel.addVacancy")}</Link>
            </Button>
          </div>
        )}
        {data && data.total > 0 && (
          <>
            <section
              aria-labelledby="funnel-feedback"
              className="rounded-xl border border-primary/40 bg-primary/5 p-5 space-y-2"
            >
              <h2 id="funnel-feedback" className="text-xl font-semibold">
                {tr("funnel.feedbackTitle")}
              </h2>
              {data.insights.length ? (
                <ul className="space-y-2">
                  {data.insights.map((i) => (
                    <li key={i.key}>{insightText(i)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tr("funnel.noFeedback")}
                </p>
              )}
            </section>
            <Stages data={data} />
            <div className="grid gap-6 md:grid-cols-2">
              <Rejections data={data} />
              <Effort data={data} />
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
