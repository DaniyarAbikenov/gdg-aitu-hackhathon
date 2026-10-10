import type { ProfileChange, ResumeRecord } from "@/api/types";
import { Button } from "@/components/ui/button";
import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useEffect, useState } from "react";
import { useApplyProfileChanges, useProfileChanges } from "../api";
import { describe, sectionName } from "../profileValues";

type Decision = "accept" | "dismiss" | undefined;

const DEFAULTS: Record<ProfileChange["kind"], Decision> = {
  update: "accept",
  removed: "accept",
  review: undefined,
  new: undefined,
};

/**
 * Differences between the master profile and this resume. Nothing changes until
 * the candidate decides; the previous text is kept in the version history.
 */
export function ProfileUpdates({
  resumeId,
  dirty,
  onApplied,
}: {
  resumeId: string;
  dirty: boolean;
  onApplied: (record: ResumeRecord) => void;
}) {
  useLocale();
  const changes = useProfileChanges(resumeId);
  const apply = useApplyProfileChanges();
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [done, setDone] = useState("");
  const data = changes.data;

  useEffect(() => {
    if (!data) return;
    setDecisions(
      Object.fromEntries(data.changes.map((c) => [c.id, DEFAULTS[c.kind]])),
    );
  }, [data]);

  if (changes.isPending) return null;
  if (changes.error)
    return (
      <p role="alert" className="text-destructive">
        {getErrorMessage(changes.error)}
      </p>
    );
  if (!data) return null;
  if (!data.changes.length)
    return (
      <p className="rounded-lg border p-3 text-sm text-muted-foreground">
        {done || tr("linked.current")}
      </p>
    );

  const accept = data.changes
    .filter((c) => decisions[c.id] === "accept")
    .map((c) => c.id);
  const dismiss = data.changes
    .filter((c) => decisions[c.id] === "dismiss")
    .map((c) => c.id);
  const save = async () => {
    setDone("");
    const record = await apply
      .mutateAsync({
        id: resumeId,
        revision: data.revision,
        accept,
        dismiss,
        label: tr("linked.versionLabel"),
      })
      .catch(() => null);
    if (record) {
      onApplied(record);
      setDone(accept.length ? tr("linked.applied") : tr("linked.kept"));
      await changes.refetch();
    }
  };
  const groups: [ProfileChange["kind"], string][] = [
    ["review", tr("linked.kinds.review")],
    ["update", tr("linked.kinds.update")],
    ["removed", tr("linked.kinds.removed")],
    ["new", tr("linked.kinds.new")],
  ];

  return (
    <section
      aria-labelledby="profile-updates"
      className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-4"
    >
      <div className="space-y-1">
        <h2 id="profile-updates" className="font-semibold">
          {tr("linked.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {data.linked ? tr("linked.explain") : tr("linked.unlinked")}
        </p>
      </div>
      {groups.map(([kind, title]) => {
        const items = data.changes.filter((c) => c.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind} className="space-y-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <ul className="space-y-2">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border bg-background p-3 text-sm space-y-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium break-words">
                      {sectionName(c.section)}
                      {c.label !== c.section && `: ${c.label}`}
                    </span>
                    {c.demand > 0 && (
                      <span className="text-xs rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        {tr("linked.demand", { count: c.demand })}
                      </span>
                    )}
                  </div>
                  {kind !== "new" && kind !== "removed" && (
                    <dl className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                      <dt className="text-muted-foreground">
                        {tr("linked.inResume")}
                      </dt>
                      <dd className="break-words">
                        {describe(c.resume) || "—"}
                      </dd>
                      <dt className="text-muted-foreground">
                        {tr("linked.inProfile")}
                      </dt>
                      <dd className="break-words">
                        {describe(c.profile) || "—"}
                      </dd>
                    </dl>
                  )}
                  {kind === "new" && typeof c.profile === "object" && (
                    <p className="break-words">{describe(c.profile)}</p>
                  )}
                  <div
                    role="radiogroup"
                    aria-label={c.label}
                    className="flex flex-wrap gap-2"
                  >
                    {(["accept", "dismiss"] as const).map((choice) => (
                      <Button
                        key={choice}
                        type="button"
                        size="sm"
                        role="radio"
                        aria-checked={decisions[c.id] === choice}
                        variant={
                          decisions[c.id] === choice ? "default" : "outline"
                        }
                        onClick={() =>
                          setDecisions({
                            ...decisions,
                            [c.id]:
                              decisions[c.id] === choice ? undefined : choice,
                          })
                        }
                      >
                        {tr(`linked.choices.${kind}.${choice}`)}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {apply.error && (
        <p role="alert" className="text-destructive">
          {getErrorMessage(apply.error)}
        </p>
      )}
      {dirty && (
        <p className="text-sm text-muted-foreground">
          {tr("linked.saveFirst")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={save}
          disabled={
            dirty || apply.isPending || !(accept.length + dismiss.length)
          }
        >
          {tr("linked.save", { count: accept.length + dismiss.length })}
        </Button>
        <span className="text-xs text-muted-foreground">
          {tr("linked.history")}
        </span>
      </div>
      {done && <p role="status">{done}</p>}
    </section>
  );
}
