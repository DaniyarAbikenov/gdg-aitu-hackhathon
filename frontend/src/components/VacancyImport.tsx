import { tr, useLocale } from "@/i18n/copy";
import { useState } from "react";
import { ArrowDownToLine, Link2 } from "lucide-react";
import client from "@/api/client";
import i18n from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCapabilities } from "@/hooks/useCapabilities";
import type { ApplicationFields } from "@/types/product";
export function VacancyImport({
  onImport,
}: {
  onImport: (fields: Partial<ApplicationFields>) => void;
}) {
  useLocale();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Partial<ApplicationFields> | null>(
    null,
  );
  const capabilities = useCapabilities();
  const parse = async () => {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const r = await client.post("/applications/import", {
        url: url || null,
        text,
        language: i18n.language === "kz" ? "kk" : i18n.language,
      });
      setPreview({ ...r.data.draft, source_url: r.data.source_url });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="import-strip p-5 space-y-3">
      <h3 className="font-semibold flex gap-2 items-center">
        <Link2 size={18} />
        {tr("copy.c112")}
      </h3>
      <p className="text-sm text-muted-foreground">{tr("copy.c113")}</p>
      <div className="flex flex-wrap gap-3">
        <Input
          className="flex-1 min-w-0"
          aria-label={tr("copy.c114")}
          type="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setPreview(null);
          }}
        />
        <Button
          type="button"
          disabled={
            busy || !capabilities?.ai || (!url && text.trim().length < 60)
          }
          onClick={parse}
        >
          {busy ? tr("copy.c115") : tr("copy.c116")}
        </Button>
      </div>
      <details>
        <summary className="text-sm cursor-pointer">{tr("copy.c117")}</summary>
        <Textarea
          aria-label={tr("copy.c118")}
          className="mt-3"
          rows={5}
          maxLength={45000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
        />
        <p className="text-xs text-muted-foreground mt-2">{tr("copy.c119")}</p>
      </details>
      {!capabilities?.ai && (
        <p className="text-sm text-muted-foreground">{tr("copy.c120")}</p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {preview && (
        <div
          className="paper-panel p-4 space-y-3"
          role="region"
          aria-label={tr("copy.c121")}
        >
          <h4 className="font-semibold text-xl">{preview.name}</h4>
          <p>
            {preview.company_name} · {preview.location}
          </p>
          <p className="whitespace-pre-wrap text-sm">{preview.description}</p>
          <div className="flex gap-2 flex-wrap">
            {preview.skills?.map((s) => (
              <span key={s} className="skill-stamp">
                {s}
              </span>
            ))}
          </div>
          <p className="text-sm">
            {preview.salary} {preview.employment}
          </p>
          <Button
            type="button"
            onClick={() => {
              onImport(preview);
              setPreview(null);
            }}
          >
            <ArrowDownToLine size={16} className="mr-2" />
            {tr("copy.c122")}
          </Button>
        </div>
      )}
    </section>
  );
}
