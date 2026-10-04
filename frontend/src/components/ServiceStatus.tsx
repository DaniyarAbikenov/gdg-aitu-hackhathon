import { useEffect, useState } from "react";
import client from "@/api/client";
export function ServiceStatus() {
  const [provider, setProvider] = useState("");
  useEffect(() => {
    client
      .get("/health")
      .then((r) =>
        setProvider(
          r.data.development || r.data.provider === "local"
            ? r.data.provider
            : "",
        ),
      )
      .catch(() => setProvider(""));
  }, []);
  if (!provider) return null;
  return (
    <p role="status" className="border-b bg-muted px-4 py-2 text-sm">
      {provider === "gemini"
        ? "ИИ: Gemini. Загружаемые резюме, описание вакансии и ответы отправляются в Google для обработки."
        : provider === "openai"
          ? "ИИ: OpenAI. Загружаемые резюме, описание вакансии и ответы отправляются в OpenAI для обработки."
          : provider === "local"
            ? "Включён тестовый режим с шаблонными ответами."
            : "ИИ пока недоступен. Нужна настройка OpenAI или Gemini на сервере. Профиль, редактирование резюме и экспорт работают."}
    </p>
  );
}
