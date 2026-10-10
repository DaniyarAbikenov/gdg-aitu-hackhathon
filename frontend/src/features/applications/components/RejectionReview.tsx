import type {
  ApplicationItem,
  NextAction,
  Rejection,
  RejectionReason,
} from "@/api/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { ArrowRight } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useReviewRejection } from "../api";

const REASONS: RejectionReason[] = [
  "no_reply",
  "screening",
  "technical",
  "assignment",
  "behavioral",
  "position_closed",
  "salary",
  "other_candidate",
  "unknown",
];
const OUTSIDE: RejectionReason[] = [
  "position_closed",
  "salary",
  "other_candidate",
];
const WITH_TOPICS: RejectionReason[] = [
  "technical",
  "assignment",
  "behavioral",
];

type Stage = Rejection["stage"];

function actionLink(action: NextAction, application: ApplicationItem) {
  const id = application.id;
  switch (action.key) {
    case "tailorResume":
      return application.data.resume_id
        ? `/resume/${application.data.resume_id}/improve?vacancy=${id}`
        : `/resume/new?vacancy=${id}`;
    case "studyTopics":
      return `/plan?vacancy=${id}&focus=${encodeURIComponent(action.topics.join("\n"))}`;
    case "practiceTechnical":
    case "practiceStory":
      return `/interview/start?vacancy=${id}`;
    case "checkSalary":
      return "/applications";
    default:
      return "/applications/funnel";
  }
}

function NextStep({
  action,
  reason,
  application,
}: {
  action: NextAction;
  reason: RejectionReason;
  application: ApplicationItem;
}) {
  const base = `rejection.actions.${action.key}`;
  return (
    <div className="rounded-lg bg-primary/5 p-4 space-y-2">
      <p className="text-sm">
        {OUTSIDE.includes(reason)
          ? tr("rejection.support.outside")
          : tr("rejection.support.skill")}
      </p>
      <h4 className="font-semibold">
        {tr("rejection.nextTitle")}: {tr(`${base}.title`)}
      </h4>
      <p className="text-sm">
        {tr(`${base}.body`, { topics: action.topics.join(", ") })}
      </p>
      <Link
        className="inline-flex items-center gap-2 text-primary underline"
        to={actionLink(action, application)}
      >
        {tr(`${base}.link`)}
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

/** Three questions after a rejection, then one concrete step. */
export function RejectionReview({
  application,
}: {
  application: ApplicationItem;
}) {
  useLocale();
  const saved = application.data.rejection ?? null;
  const reached = application.data.stages ?? {};
  const review = useReviewRejection();
  const [editing, setEditing] = useState(!saved);
  const [stage, setStage] = useState<Stage>(
    saved?.stage ?? (reached.interview ? "interview" : "applied"),
  );
  const [reason, setReason] = useState<RejectionReason | "">(
    saved?.reason ?? "",
  );
  const [topics, setTopics] = useState((saved?.topics ?? []).join("\n"));
  const [feedback, setFeedback] = useState(saved?.feedback ?? "");

  if (saved && !editing) {
    return (
      <section aria-labelledby="rejection-review" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="rejection-review" className="font-semibold">
            {tr("rejection.title")}
          </h3>
          <Button variant="link" size="sm" onClick={() => setEditing(true)}>
            {tr("rejection.edit")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {tr("rejection.summary", {
            stage: tr(`funnel.rejectedAt.${saved.stage}`),
            reason: tr(`funnel.reasons.${saved.reason}`),
          })}
        </p>
        {application.rejection_action && (
          <NextStep
            action={application.rejection_action}
            reason={saved.reason}
            application={application}
          />
        )}
      </section>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason) return;
    const result = await review
      .mutateAsync({
        id: application.id,
        revision: application.revision,
        stage,
        reason,
        topics: WITH_TOPICS.includes(reason)
          ? topics
              .split("\n")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        feedback: feedback.trim(),
      })
      .catch(() => null);
    if (result) setEditing(false);
  };

  return (
    <form
      aria-labelledby="rejection-review"
      onSubmit={submit}
      className="rounded-lg border border-primary/40 p-4 space-y-4"
    >
      <div className="space-y-1">
        <h3 id="rejection-review" className="font-semibold">
          {tr("rejection.title")}
        </h3>
        <p className="text-sm text-muted-foreground">{tr("rejection.intro")}</p>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{tr("rejection.stage")}</legend>
        {(["applied", "interview"] as const).map((value) => (
          <label key={value} className="flex gap-2 text-sm">
            <input
              type="radio"
              name="rejection-stage"
              checked={stage === value}
              onChange={() => setStage(value)}
            />
            {tr(`funnel.rejectedAt.${value}`)}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">
          {tr("rejection.reason")}
        </legend>
        {REASONS.map((value) => (
          <label key={value} className="flex gap-2 text-sm">
            <input
              type="radio"
              name="rejection-reason"
              required
              checked={reason === value}
              onChange={() => setReason(value)}
            />
            {tr(`funnel.reasons.${value}`)}
          </label>
        ))}
      </fieldset>
      {reason && WITH_TOPICS.includes(reason) && (
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{tr("rejection.topics")}</span>
          <Textarea
            value={topics}
            maxLength={900}
            placeholder={tr("rejection.topicsHint")}
            onChange={(e) => setTopics(e.target.value)}
          />
        </label>
      )}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{tr("rejection.feedback")}</span>
        <Textarea
          value={feedback}
          maxLength={2000}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </label>
      {review.error && (
        <p role="alert" className="text-destructive">
          {getErrorMessage(review.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!reason || review.isPending}>
          {tr("rejection.submit")}
        </Button>
        {saved && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(false)}
          >
            {tr("copy.c023")}
          </Button>
        )}
      </div>
    </form>
  );
}
