import type { ApplicationItem, ApplicationPayload } from "@/api/types";
import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useSaveApplication } from "../api";
import { applicationPayload } from "../payload";

type Status = NonNullable<ApplicationPayload["status"]>;

/**
 * Applications as columns by stage. Cards move by drag and drop, or with the
 * stage selector on each card for keyboard and touch users.
 */
export function ApplicationBoard({
  records,
  stages,
  onOpen,
}: {
  records: ApplicationItem[];
  stages: Record<Status, string>;
  onOpen: (id: string) => void;
}) {
  useLocale();
  const save = useSaveApplication();
  const [over, setOver] = useState<Status | null>(null);
  const columns = (Object.keys(stages) as Status[]).filter(
    (stage) =>
      stage !== "archived" || records.some((r) => r.data.status === stage),
  );

  const move = (id: string, status: Status) => {
    const record = records.find((r) => r.id === id);
    if (!record || record.data.status === status) return;
    save.mutate({
      id,
      payload: applicationPayload(record.data, record.revision, { status }),
    });
  };

  return (
    <div className="space-y-3">
      {save.error && (
        <p role="alert" className="text-destructive">
          {getErrorMessage(save.error)}
        </p>
      )}
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        aria-label={tr("board.label")}
      >
        {columns.map((stage) => {
          const cards = records.filter((r) => r.data.status === stage);
          return (
            <section
              key={stage}
              aria-label={stages[stage]}
              className={`w-64 shrink-0 rounded-xl border p-3 space-y-3 ${over === stage ? "border-primary bg-primary/5" : "bg-muted/30"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                move(e.dataTransfer.getData("text/plain"), stage);
              }}
            >
              <h3 className="font-semibold text-sm">
                {stages[stage]}{" "}
                <span className="text-muted-foreground">({cards.length})</span>
              </h3>
              {cards.map((r) => (
                <article
                  key={r.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", r.id)
                  }
                  className="rounded-lg border bg-background p-3 space-y-2 cursor-grab"
                >
                  <button
                    className="text-left w-full"
                    onClick={() => onOpen(r.id)}
                  >
                    <span className="block text-xs text-muted-foreground">
                      {r.data.company_name}
                    </span>
                    <span className="block font-medium break-words">
                      {r.data.name}
                    </span>
                    {r.data.follow_up && (
                      <span className="block text-xs text-primary">
                        {tr("copy.c055")} {r.data.follow_up}
                      </span>
                    )}
                  </button>
                  <select
                    aria-label={tr("board.move", { name: r.data.name })}
                    className="w-full rounded border bg-background p-1 text-sm"
                    value={r.data.status}
                    disabled={save.isPending}
                    onChange={(e) => move(r.id, e.target.value as Status)}
                  >
                    {(Object.keys(stages) as Status[]).map((s) => (
                      <option key={s} value={s}>
                        {stages[s]}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
