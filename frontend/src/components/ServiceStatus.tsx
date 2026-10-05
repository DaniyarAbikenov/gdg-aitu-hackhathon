import { tr, useLocale } from "@/i18n/copy";
import { useEffect, useState } from "react";
import client from "@/api/client";
export function ServiceStatus() {
  useLocale();
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
        ? tr("copy.c096")
        : provider === "openai"
          ? tr("copy.c097")
          : provider === "local"
            ? tr("copy.c098")
            : tr("copy.c099")}
    </p>
  );
}
