import { tr } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useSearchParams } from "react-router-dom";
import { useApplications } from "./api";
export function useVacancyContext() {
  const [params] = useSearchParams();
  const id = params.get("vacancy");
  const { data, error: loadError } = useApplications({ enabled: !!id });
  if (!id) return { vacancy: null, error: "" };
  if (loadError) return { vacancy: null, error: getErrorMessage(loadError) };
  if (!data) return { vacancy: null, error: "" };
  const vacancy = data.find((v) => v.id === id) ?? null;
  return { vacancy, error: vacancy ? "" : tr("copy.c129") };
}
