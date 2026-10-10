import type { SkillNode } from "@/api/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSkillMap } from "../api";
import { ScoreChart } from "../components/ScoreChart";
import { SkillDetails } from "../components/SkillDetails";
import { SkillGraph } from "../components/SkillGraph";
import { STATUS_DOT, STATUS_ORDER, latestScore } from "../status";
import { useCompact } from "../useCompact";

type View = "map" | "list";

function SkillList({
  nodes,
  onSelect,
}: {
  nodes: SkillNode[];
  onSelect: (key: string) => void;
}) {
  const sorted = [...nodes].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      b.demand - a.demand,
  );
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{tr("skillMap.title")}</caption>
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="p-2">
              {tr("skillMap.columns.skill")}
            </th>
            <th scope="col" className="p-2">
              {tr("skillMap.columns.status")}
            </th>
            <th scope="col" className="p-2">
              {tr("skillMap.columns.demand")}
            </th>
            <th scope="col" className="p-2">
              {tr("skillMap.columns.practice")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((node) => (
            <tr key={node.key} className="border-t">
              <th scope="row" className="p-2 text-left font-medium">
                <button
                  type="button"
                  className="text-primary underline break-words text-left"
                  onClick={() => onSelect(node.key)}
                >
                  {node.name}
                </button>
              </th>
              <td className="p-2">
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[node.status]}`}
                  />
                  {tr(`skillMap.status.${node.status}`)}
                </span>
              </td>
              <td className="p-2">{node.demand}</td>
              <td className="p-2">{latestScore(node) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SkillMap() {
  useLocale();
  const map = useSkillMap();
  const compact = useCompact();
  const [view, setView] = useState<View>("map");
  const [selected, setSelected] = useState<string | null>(null);
  const details = useRef<HTMLDivElement>(null);
  // On phones the details sit below the map; bring them into view.
  useEffect(() => {
    if (compact && selected)
      details.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [compact, selected]);
  const data = map.data;
  const byKey = new Map((data?.nodes ?? []).map((n) => [n.key, n]));
  const node = selected ? (byKey.get(selected) ?? null) : null;
  const strongest = data?.strongest ? byKey.get(data.strongest) : undefined;
  const next = (data?.next_to_learn ?? []).flatMap((k) => byKey.get(k) ?? []);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{tr("skillMap.title")}</h1>
          <p className="text-muted-foreground">{tr("skillMap.intro")}</p>
        </header>
        {map.error && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(map.error)}
          </p>
        )}
        {data && data.nodes.length === 0 && (
          <div className="rounded-xl border p-5 space-y-3">
            <p>{tr("skillMap.empty")}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/onboarding">{tr("skillMap.fillProfile")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/applications">{tr("skillMap.saveVacancy")}</Link>
              </Button>
            </div>
          </div>
        )}
        {data && data.nodes.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border p-4 space-y-1">
                <h2 className="text-sm text-muted-foreground">
                  {tr("skillMap.strongestTitle")}
                </h2>
                {strongest ? (
                  <p>
                    <button
                      type="button"
                      className="font-semibold text-primary underline"
                      onClick={() => setSelected(strongest.key)}
                    >
                      {strongest.name}
                    </button>{" "}
                    {tr("skillMap.strongestBody", {
                      count: strongest.demand,
                      total: data.vacancies,
                    })}
                  </p>
                ) : (
                  <p className="text-sm">{tr("skillMap.noStrongest")}</p>
                )}
              </article>
              <article className="rounded-xl border p-4 space-y-1">
                <h2 className="text-sm text-muted-foreground">
                  {tr("skillMap.nextTitle")}
                </h2>
                {next.length ? (
                  <ol className="flex flex-wrap gap-2">
                    {next.map((n) => (
                      <li key={n.key}>
                        <button
                          type="button"
                          className="rounded-full border border-rose-500/50 px-3 py-0.5 text-sm"
                          onClick={() => setSelected(n.key)}
                        >
                          {n.name} · {n.demand}
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm">{tr("skillMap.noGaps")}</p>
                )}
              </article>
            </div>

            <div
              role="tablist"
              aria-label={tr("skillMap.viewLabel")}
              className="inline-flex rounded-lg border p-1"
            >
              {(["map", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className={`rounded-md px-3 py-1 text-sm ${view === v ? "bg-primary text-primary-foreground" : ""}`}
                  onClick={() => setView(v)}
                >
                  {tr(`skillMap.views.${v}`)}
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
              <div className="space-y-3 min-w-0">
                {view === "map" ? (
                  <>
                    <SkillGraph
                      key={compact ? "tall" : "wide"}
                      compact={compact}
                      data={data}
                      selected={selected}
                      onSelect={setSelected}
                    />
                    <ul className="flex flex-wrap gap-4 text-xs">
                      {STATUS_ORDER.map((s) => (
                        <li key={s} className="flex items-center gap-1">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`}
                          />
                          {tr(`skillMap.status.${s}`)}
                        </li>
                      ))}
                      <li className="text-muted-foreground">
                        {tr("skillMap.legend")}
                      </li>
                    </ul>
                  </>
                ) : (
                  <SkillList nodes={data.nodes} onSelect={setSelected} />
                )}
              </div>
              <div ref={details} className="min-w-0 scroll-mt-4">
                {node ? (
                  <SkillDetails
                    key={node.key}
                    node={node}
                    vacancies={data.vacancies}
                  />
                ) : (
                  <p className="rounded-xl border p-5 text-sm text-muted-foreground">
                    {tr("skillMap.pick")}
                  </p>
                )}
              </div>
            </div>

            <section
              aria-labelledby="skill-scores"
              className="rounded-xl border p-5 space-y-2"
            >
              <h2 id="skill-scores" className="text-xl font-semibold">
                {tr("skillMap.scoresTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tr("skillMap.scoresHint")}
              </p>
              <ScoreChart
                sessions={data.scores}
                skill={node}
                compact={compact}
              />
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}
