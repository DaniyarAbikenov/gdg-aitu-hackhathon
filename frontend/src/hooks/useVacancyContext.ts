import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import client from "@/api/client";
import type { ApplicationRecord } from "@/types/product";
export function useVacancyContext() {
  const [params] = useSearchParams();
  const id = params.get("vacancy");
  const [vacancy, setVacancy] = useState<ApplicationRecord | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setVacancy(null);
    setError("");
    if (id)
      client
        .get<ApplicationRecord[]>("/applications")
        .then((r) => {
          if (!active) return;
          const item = r.data.find((v) => v.id === id);
          if (item) setVacancy(item);
          else
            setError(
              "Вакансия не найдена. Откройте её из списка ваших вакансий.",
            );
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [id]);
  return { vacancy, error };
}
