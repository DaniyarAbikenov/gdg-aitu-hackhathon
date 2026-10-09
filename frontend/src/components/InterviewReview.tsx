import { tr, useLocale } from "@/i18n/copy";
import type { InterviewRecord } from "@/api/interview";
import { useEffect, useState } from "react";
import client from "@/api/client";
export function InterviewReview({ id }: { id: string }) {
  useLocale();
  const [record, setRecord] = useState<InterviewRecord | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    client
      .get(`/interview/${id}`)
      .then((r) => setRecord(r.data))
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{tr("copy.c028")}</h2>
      {error && <p role="alert">{error}</p>}
      {record?.answers.map((a, i) => (
        <details key={i} className="rounded-lg border p-4">
          <summary className="cursor-pointer font-medium">
            {i + 1}. {a.question} · {a.score}/100
          </summary>
          <div className="pt-4 space-y-3">
            <h3 className="font-medium">{tr("copy.c029")}</h3>
            <p className="whitespace-pre-wrap">{a.answer}</p>
            <h3 className="font-medium">{tr("copy.c030")}</h3>
            <p>{a.feedback}</p>
            {a.reference_answer && (
              <>
                <h3 className="font-medium">{tr("copy.c031")}</h3>
                <p>{a.reference_answer}</p>
              </>
            )}
            {a.improvements.map((v, j) => (
              <p key={j}>• {v}</p>
            ))}
          </div>
        </details>
      ))}
      {record?.transcript && record.transcript.length > 0 && (
        <details className="border rounded-lg p-4">
          <summary>{tr("copy.c032")}</summary>
          <div className="space-y-3 pt-4">
            {record.transcript.map((t) => (
              <p key={t.id} className="whitespace-pre-wrap">
                <strong>
                  {t.role === "user" ? tr("copy.c033") : tr("copy.c034")}:{" "}
                </strong>
                {t.text}
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
