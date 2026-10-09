import { tr, useLocale, displayLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useOverview, usePreferences, useSavePreferences } from "../api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { NextSteps } from "../components/NextSteps";

type Widget =
  | "resumes"
  | "skills"
  | "companies"
  | "learning"
  | "activity"
  | "journey";

export default function Dashboard() {
  useLocale();
  const labels: Record<Widget, string> = {
    resumes: tr("copy.c242"),
    skills: tr("copy.c243"),
    companies: tr("copy.c244"),
    learning: tr("copy.c245"),
    activity: tr("copy.c246"),
    journey: tr("copy.c247"),
  };
  const overview = useOverview();
  const preferences = usePreferences();
  const savePreferences = useSavePreferences();
  const [pending, setPending] = useState<Widget[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveError, setError] = useState("");
  const loadFailure = overview.error ?? preferences.error;
  const error = saveError || (loadFailure ? getErrorMessage(loadFailure) : "");
  const data = overview.data && preferences.data ? overview.data : null;
  const prefs = {
    revision: preferences.data?.revision ?? 0,
    data: {
      widgets:
        pending ??
        (preferences.data?.data.widgets as Widget[] | undefined) ??
        (Object.keys(labels) as Widget[]),
    },
  };
  const busy = savePreferences.isPending;
  const load = () => {
    setError("");
    void overview.refetch();
    void preferences.refetch();
  };
  const toggle = async (key: Widget) => {
    const widgets = prefs.data.widgets.includes(key)
      ? prefs.data.widgets.filter((k) => k !== key)
      : [...prefs.data.widgets, key];
    setPending(widgets);
    try {
      await savePreferences.mutateAsync({ widgets, revision: prefs.revision });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPending(null);
    }
  };
  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{tr("copy.c248")}</h1>
            {data?.goal && <p className="text-primary mt-2">{data.goal}</p>}
            <p className="text-muted-foreground mt-2">{tr("copy.c249")}</p>
          </div>
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            {tr("copy.c250")}
          </Button>
        </header>
        <NextSteps />
        {editing && (
          <fieldset className="flex flex-wrap gap-4 rounded-lg border p-4">
            <legend>{tr("copy.c251")}</legend>
            {(Object.entries(labels) as [Widget, string][]).map(
              ([key, label]) => (
                <label key={key} className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={prefs.data.widgets.includes(key)}
                    onChange={() => toggle(key)}
                  />
                  {label}
                </label>
              ),
            )}
          </fieldset>
        )}
        {error && (
          <div role="alert">
            {error}{" "}
            <Button variant="link" onClick={load}>
              {tr("copy.c252")}
            </Button>
          </div>
        )}
        {!data && !error && <p role="status">{tr("copy.c253")}</p>}
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
                        {tr("copy.c254")} {data.reviewed_resumes}{" "}
                        {tr("copy.c255")} {data.resume_versions}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {tr("copy.c256")} {data.active_resumes}{" "}
                        {tr("copy.c257")} {data.archived_resumes}
                      </p>
                      <Link className="text-primary underline" to="/resume">
                        {tr("copy.c258")}
                      </Link>
                    </>
                  )}
                  {key === "skills" && (
                    <>
                      {data.skill_gaps.length ? (
                        data.skill_gaps.map((g) => (
                          <div key={g.name} className="flex justify-between">
                            <span>{g.name}</span>
                            <span>
                              {g.mentions} {tr("copy.c259")}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p>{tr("copy.c260")}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {tr("copy.c261")}
                      </p>
                    </>
                  )}
                  {key === "companies" && (
                    <>
                      <p>
                        {tr("copy.c262")}{" "}
                        <strong>{data.interviews_completed}</strong>
                      </p>
                      <p>
                        {tr("copy.c263")} {data.average_score ?? "—"}/100
                      </p>
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
                          {tr("copy.c264")}
                        </p>
                      )}
                      <Link className="text-primary underline" to="/interview">
                        {tr("copy.c265")}
                      </Link>
                    </>
                  )}
                  {key === "learning" && (
                    <>
                      <p className="text-4xl font-bold">
                        {data.week.learning_current}
                      </p>
                      <p>{tr("copy.c266")}</p>
                      <p className="text-sm text-muted-foreground">
                        {tr("copy.c267")} {data.week.learning_previous}{" "}
                        {tr("copy.c268")}{" "}
                        {data.week.learning_current -
                          data.week.learning_previous >
                        0
                          ? "+"
                          : ""}
                        {data.week.learning_current -
                          data.week.learning_previous}
                      </p>
                      <p>
                        {data.completed_modules} / {data.total_modules}{" "}
                        {tr("copy.c269")}
                      </p>
                      <Link className="text-primary underline" to="/plan">
                        {tr("copy.c270")}
                      </Link>
                    </>
                  )}
                  {key === "activity" && (
                    <>
                      <div
                        className="flex gap-1 h-28 items-end"
                        aria-label={tr("copy.c271")}
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
                        {tr("copy.c272")} {data.week.current} {tr("copy.c273")}{" "}
                        {data.week.previous}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tr("copy.c274")}{" "}
                        {data.tracking_started
                          ? new Date(data.tracking_started).toLocaleDateString(
                              displayLocale(),
                            )
                          : tr("copy.c275")}
                        .
                      </p>
                    </>
                  )}
                  {key === "journey" && (
                    <>
                      <p className="text-3xl font-bold">
                        {tr("copy.c040")} {data.level}
                      </p>
                      <p>
                        {data.xp} {tr("copy.c276")} {data.streak}{" "}
                        {tr("copy.c042")}
                      </p>
                      <progress
                        className="w-full accent-primary"
                        max={100}
                        value={data.level_progress}
                        aria-label={tr("copy.c277")}
                      />
                      <p className="text-sm">
                        {tr("copy.c278")} {100 - data.level_progress} XP
                      </p>
                      <Link className="text-primary underline" to="/progress">
                        {tr("copy.c279")}
                      </Link>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!prefs.data.widgets.length && <p>{tr("copy.c280")}</p>}
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/resume/new">{tr("copy.c281")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/plan">{tr("copy.c067")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/onboarding">{tr("copy.c282")}</Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
