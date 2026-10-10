import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useModerate, useModerationQueue } from "../api";
import { ReportCard } from "../components/InterviewReports";

/** Administrators approve or reject shared interview reports; authors stay anonymous. */
export default function ReportModeration() {
  useLocale();
  const queue = useModerationQueue();
  const moderate = useModerate();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const decide = (id: string, status: "approved" | "rejected") =>
    moderate.mutate({ id, status, note: notes[id] ?? "" });
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">
            {tr("companyInsights.moderationTitle")}
          </h1>
          <p className="text-muted-foreground">
            {tr("companyInsights.moderationIntro")}
          </p>
        </header>
        {(queue.error || moderate.error) && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(queue.error ?? moderate.error)}
          </p>
        )}
        {queue.isSuccess && queue.data.length === 0 && (
          <p role="status">{tr("companyInsights.queueEmpty")}</p>
        )}
        {queue.data?.map((report) => (
          <div key={report.id} className="space-y-2">
            <p className="text-sm font-medium">{report.company_name}</p>
            <ReportCard
              report={report}
              actions={
                <div className="flex flex-wrap items-end gap-2 pt-2">
                  <label className="grow text-sm">
                    {tr("companyInsights.noteLabel")}
                    <Input
                      maxLength={500}
                      value={notes[report.id] ?? ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [report.id]: e.target.value }))
                      }
                    />
                  </label>
                  <Button
                    disabled={moderate.isPending}
                    onClick={() => decide(report.id, "approved")}
                  >
                    {tr("companyInsights.approve")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={moderate.isPending}
                    onClick={() => decide(report.id, "rejected")}
                  >
                    {tr("companyInsights.reject")}
                  </Button>
                </div>
              }
            />
          </div>
        ))}
      </div>
    </MainLayout>
  );
}
