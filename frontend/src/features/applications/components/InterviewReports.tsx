import type { InterviewReport, ReportPayload } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tr } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useCompanyReports, useDeleteReport, useShareReport } from "../api";

export const OUTCOMES = [
  "offer",
  "rejected",
  "no_answer",
  "in_progress",
  "withdrew",
] as const;

const thisMonth = () => new Date().toISOString().slice(0, 7);

const blank = (): ReportPayload => ({
  role: "",
  interviewed_on: thisMonth(),
  stages: "",
  questions: [],
  difficulty: 3,
  outcome: "in_progress",
  advice: "",
});

/** One report as other candidates see it; the author also sees its moderation state. */
export function ReportCard({
  report,
  actions,
}: {
  report: InterviewReport;
  actions?: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border p-4 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4 className="font-semibold text-base">{report.role}</h4>
        <span className="text-muted-foreground">{report.interviewed_on}</span>
        <span>
          {tr("companyInsights.difficultyValue", { value: report.difficulty })}
        </span>
        <span className="rounded-full border px-2 py-0.5 text-xs">
          {tr(`companyInsights.outcomes.${report.outcome}`)}
        </span>
        {report.mine && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {tr(`companyInsights.statuses.${report.status}`)}
          </span>
        )}
      </div>
      {report.stages && (
        <p className="whitespace-pre-wrap">
          <span className="font-medium">
            {tr("companyInsights.fields.stages")}:
          </span>{" "}
          {report.stages}
        </p>
      )}
      {report.questions.length > 0 && (
        <div>
          <p className="font-medium">
            {tr("companyInsights.fields.questions")}
          </p>
          <ul className="list-disc pl-5">
            {report.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      {report.advice && (
        <p className="whitespace-pre-wrap">
          <span className="font-medium">
            {tr("companyInsights.fields.advice")}:
          </span>{" "}
          {report.advice}
        </p>
      )}
      {report.mine && report.moderation_note && (
        <p className="text-muted-foreground">
          {tr("companyInsights.moderatorNote", {
            note: report.moderation_note,
          })}
        </p>
      )}
      {actions}
    </article>
  );
}

function ShareForm({
  companyId,
  onSent,
  onCancel,
}: {
  companyId: string;
  onSent: () => void;
  onCancel: () => void;
}) {
  const share = useShareReport(companyId);
  const [form, setForm] = useState(blank);
  const [questions, setQuestions] = useState("");
  const set = <K extends keyof ReportPayload>(
    key: K,
    value: ReportPayload[K],
  ) => setForm((f) => ({ ...f, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    share.mutate(
      {
        ...form,
        questions: questions
          .split("\n")
          .map((q) => q.trim())
          .filter(Boolean)
          .slice(0, 15),
      },
      { onSuccess: onSent },
    );
  };
  return (
    <form
      aria-label={tr("companyInsights.shareTitle")}
      onSubmit={submit}
      className="rounded-lg border p-4 space-y-4"
    >
      <p className="text-sm rounded-md bg-muted p-3">
        {tr("companyInsights.privacy")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          {tr("companyInsights.fields.role")}
          <Input
            required
            minLength={2}
            maxLength={200}
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
          />
        </label>
        <label className="block">
          {tr("companyInsights.fields.month")}
          <Input
            type="month"
            required
            max={thisMonth()}
            value={form.interviewed_on}
            onChange={(e) => set("interviewed_on", e.target.value)}
          />
        </label>
        <label className="block">
          {tr("companyInsights.fields.difficulty")}
          <select
            className="block w-full"
            value={form.difficulty}
            onChange={(e) => set("difficulty", Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {tr(`companyInsights.difficulty.${n}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          {tr("companyInsights.fields.outcome")}
          <select
            className="block w-full"
            value={form.outcome}
            onChange={(e) =>
              set("outcome", e.target.value as ReportPayload["outcome"])
            }
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {tr(`companyInsights.outcomes.${o}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        {tr("companyInsights.fields.stages")}
        <Textarea
          maxLength={3000}
          placeholder={tr("companyInsights.stagesHint")}
          value={form.stages}
          onChange={(e) => set("stages", e.target.value)}
        />
      </label>
      <label className="block">
        {tr("companyInsights.fields.questions")}
        <Textarea
          maxLength={7500}
          placeholder={tr("companyInsights.questionsHint")}
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
        />
      </label>
      <label className="block">
        {tr("companyInsights.fields.advice")}
        <Textarea
          maxLength={3000}
          value={form.advice}
          onChange={(e) => set("advice", e.target.value)}
        />
      </label>
      {share.error && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(share.error)}
        </p>
      )}
      <div className="flex gap-3">
        <Button disabled={share.isPending}>{tr("companyInsights.send")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tr("companyInsights.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Anonymous reports from candidates who interviewed here, published after moderation. */
export function InterviewReports({ companyId }: { companyId: string }) {
  const reports = useCompanyReports(companyId);
  const remove = useDeleteReport(companyId);
  const [sharing, setSharing] = useState(false);
  const [sent, setSent] = useState(false);
  const list = reports.data ?? [];
  return (
    <section
      aria-labelledby="interview-reports"
      className="rounded-xl border p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id="interview-reports" className="text-xl font-semibold">
            {tr("companyInsights.reportsTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {tr("companyInsights.reportsIntro")}
          </p>
        </div>
        {!sharing && (
          <Button
            variant="outline"
            onClick={() => {
              setSharing(true);
              setSent(false);
            }}
          >
            {tr("companyInsights.share")}
          </Button>
        )}
      </div>
      {sent && (
        <p role="status" className="text-sm">
          {tr("companyInsights.sent")}
        </p>
      )}
      {sharing && (
        <ShareForm
          companyId={companyId}
          onSent={() => {
            setSharing(false);
            setSent(true);
          }}
          onCancel={() => setSharing(false)}
        />
      )}
      {reports.error && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(reports.error)}
        </p>
      )}
      {reports.isSuccess && list.length === 0 && (
        <p className="text-sm">{tr("companyInsights.noReports")}</p>
      )}
      {list.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          actions={
            report.mine && (
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(report.id)}
              >
                {tr("companyInsights.delete")}
              </Button>
            )
          }
        />
      ))}
    </section>
  );
}
