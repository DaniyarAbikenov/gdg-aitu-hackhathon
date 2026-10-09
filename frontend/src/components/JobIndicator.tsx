import { useActiveJobs } from "@/api/jobs";
import { tr, useLocale } from "@/i18n/copy";
import { Loader2 } from "lucide-react";

/** Shows that AI work is queued or running, wherever the user navigates. */
export function JobIndicator() {
  useLocale();
  const statuses = Object.values(useActiveJobs((state) => state.jobs));
  if (!statuses.length) return null;
  const running = statuses.includes("running");
  return (
    <span
      role="status"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {tr(running ? "jobs.running" : "jobs.queued")}
    </span>
  );
}
