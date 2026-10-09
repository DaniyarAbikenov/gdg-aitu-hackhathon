import { tr, useLocale } from "@/i18n/copy";
import { useHealth } from "@/api/system";
export function ServiceStatus() {
  useLocale();
  const { data } = useHealth();
  const provider =
    data && (data.development || data.provider === "local")
      ? data.provider
      : "";
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
