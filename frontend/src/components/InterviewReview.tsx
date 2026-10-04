import type { InterviewRecord } from "@/api/interview";
import { useEffect, useState } from "react";
import client from "@/api/client";
export function InterviewReview({ id }: { id: string }) {
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
      <h2 className="text-xl font-semibold">Вопросы и ваши ответы</h2>
      {error && <p role="alert">{error}</p>}
      {record?.answers.map((a, i) => (
        <details key={i} className="rounded-lg border p-4">
          <summary className="cursor-pointer font-medium">
            {i + 1}. {a.question} · {a.score}/100
          </summary>
          <div className="pt-4 space-y-3">
            <h3 className="font-medium">Ваш ответ</h3>
            <p className="whitespace-pre-wrap">{a.answer}</p>
            <h3 className="font-medium">Обратная связь</h3>
            <p>{a.feedback}</p>
            {a.reference_answer && (
              <>
                <h3 className="font-medium">Пример ответа</h3>
                <p>{a.reference_answer}</p>
              </>
            )}
            {a.improvements.map((v, j) => (
              <p key={j}>• {v}</p>
            ))}
          </div>
        </details>
      ))}
      {record?.transcript?.length > 0 && (
        <details className="border rounded-lg p-4">
          <summary>Полная расшифровка голосового интервью</summary>
          <div className="space-y-3 pt-4">
            {record.transcript.map((t) => (
              <p key={t.id} className="whitespace-pre-wrap">
                <strong>{t.role === "user" ? "Вы" : "Интервьюер"}: </strong>
                {t.text}
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
