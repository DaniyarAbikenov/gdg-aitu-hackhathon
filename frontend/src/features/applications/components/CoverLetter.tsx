import type { ApplicationItem, CoverLetterDraft } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useCoverLetter, useSaveApplication } from "../api";
import { applicationPayload } from "../payload";

/** Draft, edit and explicitly save a cover letter built from confirmed facts. */
export function CoverLetter({ application }: { application: ApplicationItem }) {
  useLocale();
  const saved = application.data.cover_letter ?? "";
  const [text, setText] = useState(saved);
  const [draft, setDraft] = useState<CoverLetterDraft | null>(null);
  const [status, setStatus] = useState("");
  const generate = useCoverLetter();
  const save = useSaveApplication();
  const failure = generate.error ?? save.error;

  const request = async () => {
    setStatus("");
    const result = await generate.mutateAsync(application.id).catch(() => null);
    if (result) {
      setDraft(result);
      setText(result.text);
    }
  };
  const accept = async () => {
    setStatus("");
    const payload = applicationPayload(application.data, application.revision, {
      cover_letter: text,
    });
    const result = await save
      .mutateAsync({ id: application.id, payload })
      .catch(() => null);
    if (result) {
      setDraft(null);
      setStatus(tr("letter.saved"));
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(tr("letter.copied"));
    } catch {
      setStatus(tr("letter.copyFailed"));
    }
  };

  return (
    <section aria-labelledby="cover-letter" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="cover-letter" className="font-semibold">
          {tr("letter.title")}
        </h3>
        <Button
          variant="outline"
          onClick={request}
          disabled={generate.isPending}
        >
          {generate.isPending
            ? tr("letter.drafting")
            : saved || draft
              ? tr("letter.redraft")
              : tr("letter.draft")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{tr("letter.explain")}</p>
      {failure && (
        <p role="alert" className="text-destructive">
          {getErrorMessage(failure)}
        </p>
      )}
      {draft && (
        <div className="rounded-lg bg-primary/5 p-4 text-sm space-y-2">
          {draft.provider === "local" && (
            <p className="font-medium">{tr("letter.testProvider")}</p>
          )}
          {draft.facts_used.length > 0 && (
            <p>
              {tr("letter.facts")} {draft.facts_used.join(" · ")}
            </p>
          )}
          {draft.missing_skills.length > 0 && (
            <p>
              {tr("letter.missing")} {draft.missing_skills.join(", ")}
            </p>
          )}
        </div>
      )}
      {(draft || saved) && (
        <>
          <Textarea
            aria-label={tr("letter.title")}
            className="min-h-64"
            value={text}
            maxLength={6000}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={accept}
              disabled={save.isPending || !text.trim() || text === saved}
            >
              {tr("letter.save")}
            </Button>
            <Button variant="outline" onClick={copy} disabled={!text.trim()}>
              {tr("letter.copy")}
            </Button>
          </div>
        </>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
