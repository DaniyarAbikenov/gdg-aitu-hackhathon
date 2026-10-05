import { tr, useLocale, displayLocale } from "@/i18n/copy";
import type { SnapshotRecord } from "@/types/product";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "@/api/client";
import { getResume, saveVersion, type ResumeRecord } from "@/api/resume";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function text(value: unknown): string {
  if (!value) return "—";
  if (Array.isArray(value)) return value.map(text).join("\n\n");
  if (typeof value === "object")
    return Object.values(value).filter(Boolean).map(text).join(" · ");
  return String(value);
}
export default function ResumeVersions() {
  useLocale();
  const names = {
    full_name: tr("copy.c468"),
    position: tr("copy.c469"),
    email: "Email",
    phone: tr("copy.c086"),
    location: tr("copy.c073"),
    summary: tr("copy.c090"),
    skills: tr("copy.c104"),
    experience: tr("copy.c470"),
    education: tr("copy.c076"),
    projects: tr("copy.c081"),
    certificates: tr("copy.c444"),
    languages: tr("copy.c445"),
  };
  const { resumeId } = useParams();
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [versions, setVersions] = useState<SnapshotRecord[]>([]);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = async () => {
    const [r, v] = await Promise.all([
      getResume(resumeId!),
      client.get(`/resume/${resumeId}/versions`),
    ]);
    setResume(r);
    setVersions(v.data);
  };
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [resumeId]);
  const save = async () => {
    setBusy(true);
    try {
      await saveVersion(
        resumeId!,
        resume!.fields,
        resume!.revision,
        label.trim() || tr("dynamic.version", { count: versions.length + 1 }),
        resume!.jd_text,
      );
      await load();
      setLabel("");
      setNotice(tr("copy.c471"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const restore = async (id: string) => {
    if (!window.confirm(tr("copy.c472"))) return;
    setBusy(true);
    try {
      await client.post(`/versions/${id}/restore`, {
        revision: resume!.revision,
      });
      await load();
      setNotice(tr("copy.c473"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-bold">{tr("copy.c439")}</h1>
          <p className="text-muted-foreground mt-2">
            {resume?.title || resume?.filename}
          </p>
        </header>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="flex flex-wrap gap-3">
          <Input
            className="sm:max-w-sm"
            aria-label={tr("copy.c474")}
            placeholder={tr("copy.c475")}
            value={label}
            maxLength={160}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button disabled={busy || !resume} onClick={save}>
            {tr("copy.c476")}
          </Button>
          <Button asChild variant="outline">
            <Link to={`/resume/${resumeId}/edit`}>{tr("copy.c477")}</Link>
          </Button>
        </div>
        {resume && !versions.length && (
          <p className="border rounded-lg p-5">{tr("copy.c478")}</p>
        )}
        {versions.map((v) => (
          <section key={v.id} className="rounded-xl border p-5 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{v.data.label}</h2>
              <p className="text-sm text-muted-foreground">
                {new Date(v.created_at).toLocaleString(displayLocale())}
              </p>
              {v.data.jd_text && (
                <details className="pt-2">
                  <summary>{tr("copy.c479")}</summary>
                  <p className="whitespace-pre-wrap text-sm pt-2">
                    {v.data.jd_text}
                  </p>
                </details>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href={`/api/versions/${v.id}/pdf`}>{tr("ui.pdf")}</a>
              </Button>
              <Button asChild variant="outline">
                <a href={`/api/versions/${v.id}/docx`}>Word</a>
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => restore(v.id)}
              >
                {tr("copy.c480")}
              </Button>
            </div>
            <details>
              <summary className="cursor-pointer">{tr("copy.c481")}</summary>
              <div className="space-y-4 pt-4">
                {Object.entries(names).map(([key, title]) => {
                  const before = text(v.data.before[key]);
                  const after = text(v.data.fields[key]);
                  return (
                    <div key={key} className="border-t pt-3">
                      <h3 className="font-semibold">{title}</h3>
                      {before === after ? (
                        <p className="whitespace-pre-wrap text-sm mt-2">
                          {after}
                        </p>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-3 mt-2">
                          <div className="rounded bg-muted p-3">
                            <p className="text-xs mb-2">{tr("copy.c482")}</p>
                            <p className="whitespace-pre-wrap text-sm">
                              {before}
                            </p>
                          </div>
                          <div className="rounded bg-primary/10 p-3">
                            <p className="text-xs mb-2">{tr("copy.c483")}</p>
                            <p className="whitespace-pre-wrap text-sm">
                              {after}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          </section>
        ))}
      </div>
    </MainLayout>
  );
}
