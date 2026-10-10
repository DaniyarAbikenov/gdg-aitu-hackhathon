import type { SkillNode } from "@/api/types";
import { Button } from "@/components/ui/button";
import { useProfile, useUpdateProfile } from "@/features/profile/api";
import { tr } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { skillMapKeys } from "../api";
import { STATUS_DOT, latestScore } from "../status";

/** What the map knows about one skill, and the next steps for it. */
export function SkillDetails({
  node,
  vacancies,
}: {
  node: SkillNode;
  vacancies: number;
}) {
  const profile = useProfile();
  const update = useUpdateProfile();
  const queryClient = useQueryClient();
  const score = latestScore(node);
  const addToProfile = async () => {
    const skills = profile.data?.data.skills ?? [];
    const saved = await update
      .mutateAsync({
        patch: { skills: [...skills, node.name] },
        revision: profile.data?.revision,
      })
      .catch(() => null);
    if (saved)
      await queryClient.invalidateQueries({ queryKey: skillMapKeys.all });
  };
  const learning = node.learning;
  return (
    <section
      aria-labelledby="skill-details"
      className="rounded-xl border p-5 space-y-4"
    >
      <div className="space-y-1">
        <h2 id="skill-details" className="text-xl font-semibold break-words">
          {node.name}
        </h2>
        <p className="flex items-center gap-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[node.status]}`}
          />
          {tr(`skillMap.status.${node.status}`)}
        </p>
        <p className="text-sm text-muted-foreground">
          {tr(`skillMap.explain.${node.status}`, {
            count: node.demand,
            total: vacancies,
          })}
        </p>
      </div>
      {node.vacancies.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">{tr("skillMap.askedBy")}</h3>
          <ul className="text-sm">
            {node.vacancies.map((v) => (
              <li key={v.id}>
                <Link
                  className="text-primary underline break-words"
                  to={`/applications?id=${v.id}`}
                >
                  {[v.name, v.company].filter(Boolean).join(" · ")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {learning && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">
            {tr("skillMap.learningProgress", {
              completed: learning.completed,
              total: learning.total,
            })}
          </h3>
          <div className="h-2 rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-2 rounded-full bg-sky-500"
              style={{
                width: `${learning.total ? (learning.completed / learning.total) * 100 : 0}%`,
              }}
            />
          </div>
          <Link
            className="text-sm text-primary underline"
            to={`/plan/${learning.plans[0]}`}
          >
            {tr("skillMap.openPlan")}
          </Link>
        </div>
      )}
      {score !== null && (
        <p className="text-sm">
          {tr("skillMap.practiceSummary", {
            score,
            sessions: node.practice.length,
          })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!node.in_profile && (
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending || !profile.data}
            onClick={addToProfile}
          >
            {tr("skillMap.addToProfile")}
          </Button>
        )}
        {!node.in_profile && (
          <Button size="sm" asChild>
            <Link to={`/plan?focus=${encodeURIComponent(node.name)}`}>
              {tr("skillMap.learn")}
            </Link>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link to={`/interview/start?skill=${encodeURIComponent(node.name)}`}>
            {tr("skillMap.practise")}
          </Link>
        </Button>
      </div>
      {update.error && (
        <p role="alert" className="text-destructive text-sm">
          {getErrorMessage(update.error)}
        </p>
      )}
    </section>
  );
}
