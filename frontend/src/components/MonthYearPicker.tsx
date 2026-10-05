import { tr, useLocale, displayLocale } from "@/i18n/copy";

export function canonicalPeriod(value: string): string {
  if (
    /^(present|current|now|по настоящее время|настоящее время|н\.\s?в\.|қазіргі уақыт(?:қа дейін)?)$/i.test(
      value.trim(),
    )
  )
    return "present";
  const iso = value.match(/^(\d{4})(?:-(\d{2})(?:-\d{2})?)?$/);
  if (iso && (!iso[2] || (+iso[2] >= 1 && +iso[2] <= 12)))
    return iso[1] + (iso[2] ? "-" + iso[2] : "");
  const local = value.match(/^(0?[1-9]|1[0-2])[./](\d{4})$/);
  return local ? `${local[2]}-${local[1].padStart(2, "0")}` : "";
}

export function YearPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  useLocale();
  const last = Math.max(new Date().getFullYear() + 10, value || 0);
  const first = Math.min(1900, value || 1900);
  return (
    <select
      aria-label={label}
      className="w-full"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="">{tr("period.unknown")}</option>
      {Array.from({ length: last - first + 1 }, (_, i) => last - i).map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}

export function MonthYearPicker({
  value,
  onChange,
  label,
  allowPresent = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  allowPresent?: boolean;
}) {
  useLocale();
  const normalized = canonicalPeriod(value);
  const current = normalized === "present";
  const [year, month] = current ? ["", ""] : normalized.split("-");
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, "0"),
    label: new Intl.DateTimeFormat(displayLocale(), {
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2020, i, 1))),
  }));
  return (
    <fieldset className="space-y-2 min-w-0" aria-label={label}>
      <legend className="text-sm font-medium mb-1">{label}</legend>
      {!current && (
        <div className="grid grid-cols-2 gap-2">
          <YearPicker
            label={`${label}: ${tr("period.year")}`}
            value={Number(year) || 0}
            onChange={(y) =>
              onChange(y ? `${y}${month ? "-" + month : ""}` : "")
            }
          />
          <select
            className="w-full"
            disabled={!year}
            aria-label={`${label}: ${tr("period.month")}`}
            value={month || ""}
            onChange={(e) =>
              onChange(`${year}${e.target.value ? "-" + e.target.value : ""}`)
            }
          >
            <option value="">{tr("period.monthUnknown")}</option>
            {months.map((m) => (
              <option value={m.value} key={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {allowPresent && (
        <label className="flex gap-2 items-center text-sm">
          <input
            type="checkbox"
            checked={current}
            onChange={(e) => onChange(e.target.checked ? "present" : "")}
          />
          {tr("period.present")}
        </label>
      )}
      {value && !normalized && (
        <p className="text-sm text-amber-800" role="status">
          {tr("period.legacy", { value })}
        </p>
      )}
    </fieldset>
  );
}
