import { displayLocale, tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAiUsage } from "../api";

const PERIODS = [7, 30, 90] as const;

/** Administrator view of AI calls, tokens and the configured cost estimate. */
export default function AiUsage() {
  useLocale();
  const [days, setDays] = useState<number>(30);
  const usage = useAiUsage(days);
  const number = (value: number) => value.toLocaleString(displayLocale());
  const money = (value: number | null | undefined) =>
    value == null
      ? "—"
      : value.toLocaleString(displayLocale(), {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 4,
        });
  const report = usage.data;
  const busiest = Math.max(
    1,
    ...(report?.daily ?? []).map((d) => d.input_tokens + d.output_tokens),
  );

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">{tr("usage.title")}</h1>
          <label className="flex items-center gap-2 text-sm">
            {tr("usage.period")}
            <select
              className="border rounded p-2 bg-background"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {tr("usage.days", { count: p })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-muted-foreground">{tr("usage.explain")}</p>
        {usage.error && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(usage.error)}
          </p>
        )}
        {usage.isLoading && <p role="status">{tr("usage.loading")}</p>}
        {report && (
          <>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(
                [
                  ["usage.calls", number(report.totals.calls)],
                  ["usage.failed", number(report.totals.failed)],
                  [
                    "usage.tokens",
                    number(
                      report.totals.input_tokens + report.totals.output_tokens,
                    ),
                  ],
                  ["usage.cost", money(report.totals.cost_usd)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="border rounded-xl p-4">
                  <dt className="text-sm text-muted-foreground">{tr(label)}</dt>
                  <dd className="text-2xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {!report.priced && (
              <p className="text-sm text-muted-foreground">
                {tr("usage.unpriced")}
              </p>
            )}
            {report.operations.length === 0 ? (
              <p>{tr("usage.empty")}</p>
            ) : (
              <>
                <section aria-labelledby="by-task" className="space-y-2">
                  <h2 id="by-task" className="font-semibold">
                    {tr("usage.byTask")}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="p-2">{tr("usage.task")}</th>
                          <th className="p-2">{tr("usage.model")}</th>
                          <th className="p-2 text-right">
                            {tr("usage.calls")}
                          </th>
                          <th className="p-2 text-right">
                            {tr("usage.input")}
                          </th>
                          <th className="p-2 text-right">
                            {tr("usage.output")}
                          </th>
                          <th className="p-2 text-right">
                            {tr("usage.latency")}
                          </th>
                          <th className="p-2 text-right">{tr("usage.cost")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.operations.map((row) => (
                          <tr
                            key={`${row.provider}-${row.model}-${row.operation}`}
                            className="border-t"
                          >
                            <td className="p-2">{row.operation}</td>
                            <td className="p-2">
                              {row.provider} · {row.model}
                            </td>
                            <td className="p-2 text-right">
                              {number(row.calls)}
                              {row.failed > 0 &&
                                ` (${tr("usage.failedCount", { count: row.failed })})`}
                            </td>
                            <td className="p-2 text-right">
                              {number(row.input_tokens)}
                            </td>
                            <td className="p-2 text-right">
                              {number(row.output_tokens)}
                            </td>
                            <td className="p-2 text-right">
                              {number(row.average_ms)} ms
                            </td>
                            <td className="p-2 text-right">
                              {money(row.cost_usd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section aria-labelledby="by-day" className="space-y-2">
                  <h2 id="by-day" className="font-semibold">
                    {tr("usage.byDay")}
                  </h2>
                  <ul className="space-y-1">
                    {report.daily.map((day) => {
                      const total = day.input_tokens + day.output_tokens;
                      return (
                        <li
                          key={day.day}
                          className="grid grid-cols-[6rem_1fr_7rem] items-center gap-3 text-sm"
                        >
                          <span>{day.day}</span>
                          <span
                            className="h-3 rounded bg-primary"
                            style={{ width: `${(total / busiest) * 100}%` }}
                            aria-hidden="true"
                          />
                          <span className="text-right">
                            {number(total)} · {money(day.cost_usd)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
