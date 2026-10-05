import { Link } from "react-router-dom";
import type { ApplicationRecord } from "@/types/product";
export function VacancyContext({
  vacancy,
}: {
  vacancy: ApplicationRecord | null;
}) {
  return vacancy ? (
    <div className="border-l-4 border-primary bg-primary/5 rounded-r-lg px-4 py-3 text-sm">
      <p className="font-medium">
        {vacancy.data.company_name} · {vacancy.data.name}
      </p>
      <Link
        to={`/applications?id=${vacancy.id}`}
        className="text-primary underline"
      >
        Вернуться к подготовке по вакансии
      </Link>
    </div>
  ) : null;
}
