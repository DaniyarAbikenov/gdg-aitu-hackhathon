import type { PracticeScore, SkillNode } from "@/api/types";
import { displayLocale, tr } from "@/i18n/copy";

const W = 600;
const H = 200;
const PAD = { left: 36, right: 16, top: 12, bottom: 28 };

type Point = { at: string; score: number };

function day(at: string) {
  return new Intl.DateTimeFormat(displayLocale(), {
    day: "numeric",
    month: "short",
  }).format(new Date(at));
}

/** Practice scores over time: every session, and the selected skill on top. */
export function ScoreChart({
  sessions,
  skill,
}: {
  sessions: PracticeScore[];
  skill: SkillNode | null;
}) {
  const overall: Point[] = sessions.flatMap((s) =>
    s.score === null ? [] : [{ at: s.at, score: s.score }],
  );
  const focus: Point[] = skill?.practice ?? [];
  const times = [...overall, ...focus].map((p) => new Date(p.at).getTime());
  if (!times.length)
    return (
      <p className="text-sm text-muted-foreground">{tr("skillMap.noScores")}</p>
    );
  const first = Math.min(...times);
  const last = Math.max(...times);
  const x = (at: string) =>
    last === first
      ? (PAD.left + W - PAD.right) / 2
      : PAD.left +
        ((new Date(at).getTime() - first) / (last - first)) *
          (W - PAD.left - PAD.right);
  const y = (score: number) =>
    PAD.top + (1 - score / 100) * (H - PAD.top - PAD.bottom);
  const path = (points: Point[]) =>
    points.map((p, i) => `${i ? "L" : "M"}${x(p.at)},${y(p.score)}`).join(" ");

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        aria-hidden="true"
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-muted"
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {v}
            </text>
          </g>
        ))}
        <text
          x={PAD.left}
          y={H - 6}
          className="fill-muted-foreground text-[11px]"
        >
          {day(new Date(first).toISOString())}
        </text>
        {last !== first && (
          <text
            x={W - PAD.right}
            y={H - 6}
            textAnchor="end"
            className="fill-muted-foreground text-[11px]"
          >
            {day(new Date(last).toISOString())}
          </text>
        )}
        <path
          d={path(overall)}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        {overall.map((p, i) => (
          <circle
            key={`o${i}`}
            cx={x(p.at)}
            cy={y(p.score)}
            r={3}
            className="fill-muted-foreground"
          />
        ))}
        {focus.length > 0 && (
          <>
            <path
              d={path(focus)}
              fill="none"
              className="stroke-primary"
              strokeWidth={2.5}
            />
            {focus.map((p, i) => (
              <circle
                key={`f${i}`}
                cx={x(p.at)}
                cy={y(p.score)}
                r={4.5}
                className="fill-primary"
              />
            ))}
          </>
        )}
      </svg>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{tr("skillMap.chartAll")}</span>
        {skill && focus.length > 0 && (
          <span className="text-primary font-medium">
            {tr("skillMap.chartSkill", { skill: skill.name })}
          </span>
        )}
      </figcaption>
      <table className="sr-only">
        <caption>{tr("skillMap.scoresTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{tr("skillMap.date")}</th>
            <th scope="col">{tr("skillMap.chartAll")}</th>
            {skill && (
              <th scope="col">
                {tr("skillMap.chartSkill", { skill: skill.name })}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.interview_id}>
              <th scope="row">{day(s.at)}</th>
              <td>{s.score ?? ""}</td>
              {skill && (
                <td>
                  {skill.practice.find((p) => p.interview_id === s.interview_id)
                    ?.score ?? ""}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
