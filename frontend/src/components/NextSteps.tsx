import { tr, useLocale } from "@/i18n/copy";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import client from "@/api/client";
import type { ApplicationRecord } from "@/types/product";
export function NextSteps() {
  useLocale();
  const [items, setItems] = useState<ApplicationRecord[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    client
      .get<ApplicationRecord[]>("/applications")
      .then((r) =>
        setItems(
          r.data
            .filter(
              (a) => !["archived", "rejected", "offer"].includes(a.data.status),
            )
            .sort((a, b) =>
              (a.data.follow_up || "9999").localeCompare(
                b.data.follow_up || "9999",
              ),
            ),
        ),
      )
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section
      className="rounded-xl border bg-primary/5 p-5 space-y-3"
      aria-label={tr("copy.c052")}
    >
      <div className="flex flex-wrap gap-3 justify-between">
        <h2 className="text-xl font-semibold">{tr("copy.c053")}</h2>
        <Link to="/applications" className="text-primary underline">
          {tr("copy.c054")}
        </Link>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !items ? (
        <p>{tr("copy.c000")}</p>
      ) : items.length ? (
        items.slice(0, 3).map((a) => (
          <Link
            to={`/applications?id=${a.id}`}
            key={a.id}
            className="flex gap-3 items-center justify-between rounded-lg bg-background border p-3 hover:border-primary"
          >
            <div>
              <p className="font-medium">
                {a.data.company_name} · {a.data.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {a.next_step_key && a.next_step_key !== "custom"
                  ? tr("nextStep." + a.next_step_key)
                  : a.next_step}
              </p>
              {a.data.follow_up && (
                <p className="text-sm">
                  {tr("copy.c055")} {a.data.follow_up}
                </p>
              )}
            </div>
            <ArrowRight className="shrink-0" size={18} />
          </Link>
        ))
      ) : (
        <>
          <p>{tr("copy.c056")}</p>
          <Link
            className="inline-flex items-center gap-2 font-medium text-primary underline"
            to="/applications"
          >
            {tr("copy.c057")}
            <ArrowRight size={16} />
          </Link>
        </>
      )}
    </section>
  );
}
