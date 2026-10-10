import { tr, useLocale, displayLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import type { ResumeRecord } from "@/api/types";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload } from "lucide-react";
import {
  useResumeLinks,
  useResumes,
  useUpdateResumeMetadata,
  useUploadResume,
} from "../api";

export default function Resume() {
  useLocale();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const resumes = useResumes();
  const links = useResumeLinks().data ?? {};
  const uploadResume = useUploadResume();
  const updateMetadata = useUpdateResumeMetadata();
  const loading = resumes.isPending;
  const saved = resumes.data ?? [];
  const shownError =
    error || (resumes.error ? getErrorMessage(resumes.error) : "");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ResumeRecord | null>(null);
  const choose = (f?: File) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024 || !/\.(pdf|docx|txt)$/i.test(f.name)) {
      setError(tr("copy.c421"));
      return;
    }
    setFile(f);
    setError("");
  };
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const r = await uploadResume.mutateAsync(file);
      navigate(`/resume/${r.resume_id}/edit`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const saveMeta = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateMetadata.mutateAsync({
        id: editing.resume_id,
        revision: editing.revision,
        title: editing.title,
        description: editing.description,
        lifecycle: editing.lifecycle,
      });
      setEditing(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const status = {
    draft: tr("copy.c354"),
    active: tr("copy.c422"),
    archived: tr("copy.c226"),
  };
  const visible = saved.filter(
    (r) =>
      (filter === "all" || r.lifecycle === filter) &&
      `${r.title} ${r.filename} ${r.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap gap-4 items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("resume.title")}</h1>
            <p className="text-muted-foreground">{tr("copy.c423")}</p>
          </div>
          <Button asChild>
            <Link to="/resume/new">{tr("copy.c424")}</Link>
          </Button>
        </header>
        {shownError && (
          <p role="alert" className="text-destructive">
            {shownError}
          </p>
        )}
        <section
          className={`border-2 border-dashed rounded-xl p-8 text-center space-y-4 ${drag ? "border-primary bg-primary/5" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy) choose(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            disabled={busy}
            id="resume-upload"
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <label
            htmlFor="resume-upload"
            className="cursor-pointer flex flex-col items-center gap-3"
          >
            <Upload className="h-10 w-10 text-primary" />
            <span>{file ? file.name : tr("copy.c425")}</span>
            <span className="text-sm text-muted-foreground">
              {tr("copy.c426")}
            </span>
          </label>
          <Button disabled={!file || busy} onClick={upload}>
            {busy ? tr("copy.c427") : t("resume.continue")}
          </Button>
          <p className="text-xs text-muted-foreground">{tr("copy.c428")}</p>
        </section>
        <div className="flex flex-wrap gap-3">
          <Input
            className="sm:max-w-sm"
            aria-label={tr("copy.c429")}
            placeholder={tr("copy.c430")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label={tr("copy.c431")}
            className="border rounded px-3 bg-background"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{tr("copy.c432")}</option>
            {Object.entries(status).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {loading && <p role="status">{tr("copy.c433")}</p>}
        {!loading && !visible.length && (
          <p className="rounded-lg border p-6 text-muted-foreground">
            {tr("copy.c434")}
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {visible.map((r) => (
            <Card key={r.resume_id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex gap-3 items-start">
                  <FileText className="shrink-0 text-primary" />
                  <div className="min-w-0">
                    <Link
                      className="font-semibold break-words text-lg"
                      to={`/resume/${r.resume_id}/edit`}
                    >
                      {r.title || r.filename}
                    </Link>
                    <p className="text-sm text-muted-foreground break-words">
                      {tr("copy.c435")} {r.filename}
                    </p>
                  </div>
                  <span className="ml-auto text-xs rounded-full bg-muted px-2 py-1 whitespace-nowrap">
                    {status[r.lifecycle]}
                  </span>
                </div>
                {links[r.resume_id] && links[r.resume_id] !== "current" && (
                  <Link
                    to={`/resume/${r.resume_id}/edit`}
                    className={`block rounded-md px-3 py-2 text-sm ${links[r.resume_id] === "suggestions" ? "bg-muted" : "bg-primary/10 text-primary"}`}
                  >
                    {tr(`linked.status.${links[r.resume_id]}`)}
                  </Link>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">
                  {r.description || tr("copy.c436")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tr("copy.c286")}{" "}
                  {new Date(r.updated_at || r.created_at).toLocaleString(
                    displayLocale(),
                  )}{" "}
                  ·{" "}
                  {r.status === "reviewed" ? tr("copy.c437") : tr("copy.c438")}
                </p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link
                    className="text-primary underline"
                    to={`/resume/${r.resume_id}`}
                  >
                    {tr("copy.c439")}
                  </Link>
                  <a href={`/api/resume/${r.resume_id}/pdf`}>PDF</a>
                  <a href={`/api/resume/${r.resume_id}/docx`}>Word</a>
                  <button
                    className="text-primary"
                    onClick={() => setEditing(r)}
                  >
                    {tr("copy.c440")}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {editing && (
          <section
            aria-label={tr("copy.c441")}
            className="border rounded-xl p-5 space-y-3"
          >
            <h2 className="font-semibold">{tr("copy.c440")}</h2>
            <label className="block">
              {tr("copy.c137")}
              <Input
                value={editing.title}
                maxLength={200}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <label className="block">
              {tr("copy.c138")}
              <Textarea
                value={editing.description}
                maxLength={2000}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </label>
            <select
              aria-label={tr("copy.c442")}
              value={editing.lifecycle}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  lifecycle: e.target.value as ResumeRecord["lifecycle"],
                })
              }
              className="border p-2 rounded bg-background"
            >
              {Object.entries(status).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <Button
                disabled={busy || !editing.title.trim()}
                onClick={saveMeta}
              >
                {tr("copy.c443")}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                {tr("copy.c023")}
              </Button>
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
}
