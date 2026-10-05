import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import client from "@/api/client";
import { structured } from "@/api/resume";
import { tr, useLocale } from "@/i18n/copy";
import { useCapabilities } from "@/hooks/useCapabilities";
import { mergeProfileImport } from "@/lib/profileImport";
import type { ResumeFields } from "@/types/resume";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProfileBlocks } from "@/components/ProfileBlocks";
export function ProfilePdfImport({
  current,
  onApply,
}: {
  current: ResumeFields;
  onApply: (fields: ResumeFields) => void;
}) {
  useLocale();
  const fileInput = useRef<HTMLInputElement>(null);
  const capabilities = useCapabilities();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dragging, setDragging] = useState(false),
    [notice, setNotice] = useState(false);
  const [draft, setDraft] = useState<ResumeFields | null>(null);
  const [filename, setFilename] = useState("");
  const [selected, setSelected] = useState<(keyof ResumeFields)[]>([]);
  const fields: [keyof ResumeFields, string][] = [
    ["full_name", tr("copy.c468")],
    ["position", tr("copy.c469")],
    ["email", "Email"],
    ["phone", tr("copy.c086")],
    ["location", tr("copy.c073")],
    ["summary", tr("copy.c090")],
    ["skills", tr("copy.c104")],
    ["experience", tr("copy.c068")],
    ["education", tr("copy.c076")],
    ["projects", tr("copy.c081")],
    ["certificates", tr("copy.c444")],
    ["languages", tr("copy.c445")],
  ];
  const hasValue = (v: unknown) =>
    Array.isArray(v) ? v.length > 0 : typeof v === "string" && !!v.trim();
  const parse = async (file?: File) => {
    if (!file || busy || !capabilities?.ai) return;
    setError("");
    setNotice(false);
    if (!/\.pdf$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      setError(tr("profileImport.fileError"));
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await client.post("/user/profile/import", form);
      const result = structured(data.fields);
      setDraft(result);
      setFilename(data.filename);
      setSelected(
        fields
          .filter(
            ([key]) =>
              hasValue(result[key]) &&
              (Array.isArray(result[key]) || !hasValue(current[key])),
          )
          .map(([key]) => key),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  return (
    <section
      className="import-strip p-5 space-y-4"
      aria-label={tr("profileImport.title")}
    >
      <h2 className="text-xl font-semibold flex gap-2 items-center">
        <FileUp size={20} />
        {tr("profileImport.title")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {tr("profileImport.intro")}
      </p>
      <div
        className={`rounded-xl border-2 border-dashed p-5 text-center ${dragging ? "border-primary bg-card" : "border-border"}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy && capabilities?.ai) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void parse(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label={tr("profileImport.choose")}
          disabled={busy || !capabilities?.ai}
          onChange={(e) => void parse(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || !capabilities?.ai}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? tr("profileImport.busy") : tr("profileImport.choose")}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          {tr("profileImport.limit")}
        </p>
      </div>
      {!capabilities?.ai && (
        <p className="text-sm text-muted-foreground">
          {tr("profileImport.unavailable")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{tr("profileImport.applied")}</p>}
      {draft && (
        <div
          role="region"
          aria-label={tr("profileImport.preview")}
          className="paper-panel p-4 space-y-4"
        >
          <h3 className="font-semibold">
            {tr("profileImport.preview")} · {filename}
          </h3>
          <p className="text-sm text-muted-foreground">
            {tr("profileImport.mergeHelp")}
          </p>
          <fieldset className="grid sm:grid-cols-2 gap-3">
            <legend className="font-medium mb-2">
              {tr("profileImport.select")}
            </legend>
            {fields.map(([key, label]) => (
              <label key={key} className="flex gap-2 items-start text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={!hasValue(draft[key])}
                  checked={selected.includes(key)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, key]
                        : s.filter((k) => k !== key),
                    )
                  }
                />
                <span>
                  {label}
                  {Array.isArray(draft[key]) ? ` (${draft[key].length})` : ""}
                  {!hasValue(draft[key])
                    ? ` · ${tr("profileImport.missing")}`
                    : ""}
                </span>
              </label>
            ))}
          </fieldset>
          <details>
            <summary className="cursor-pointer font-medium">
              {tr("profileImport.edit")}
            </summary>
            <div className="space-y-4 mt-4">
              <label className="block">
                {tr("copy.c468")}
                <Input
                  aria-label={tr("copy.c468")}
                  value={draft.full_name || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, full_name: e.target.value })
                  }
                />
              </label>
              <label className="block">
                {tr("copy.c104")}
                <Textarea
                  aria-label={tr("copy.c104")}
                  value={draft.skills?.join("\n") || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      skills: e.target.value
                        .split("\n")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <ProfileBlocks value={draft} onChange={setDraft} />
            </div>
          </details>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!selected.length}
              onClick={() => {
                onApply(mergeProfileImport(current, draft, selected));
                setDraft(null);
                setNotice(true);
              }}
            >
              {tr("profileImport.apply")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft(null)}
            >
              {tr("copy.c023")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
