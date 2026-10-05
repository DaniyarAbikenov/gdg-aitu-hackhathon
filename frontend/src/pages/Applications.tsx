import { tr, useLocale } from "@/i18n/copy";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BriefcaseBusiness, ArrowRight, Plus } from "lucide-react";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VacancyImport } from "@/components/VacancyImport";
import type { CompanyRecord } from "./Companies";
import { SkillPicker } from "@/components/SkillPicker";
import type { ResumeRecord } from "@/api/resume";
import type { ApplicationRecord, ApplicationFields } from "@/types/product";

const empty: ApplicationFields = {
  location: "",
  employment: "",
  salary: "",
  requirements: [],
  responsibilities: [],
  name: "",
  company_name: "",
  company_description: "",
  description: "",
  skills: [],
  status: "saved",
  source_url: "",
  resume_id: "",
  company_id: "",
  notes: "",
  next_action: "",
  follow_up: "",
};
export default function Applications() {
  useLocale();
  const stages = {
    saved: tr("copy.c141"),
    preparing: tr("copy.c142"),
    applied: tr("copy.c143"),
    interview: tr("copy.c144"),
    offer: tr("copy.c145"),
    rejected: tr("copy.c146"),
    archived: tr("copy.c147"),
  };
  const [params, setParams] = useSearchParams();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [draft, setDraft] = useState<ApplicationFields | null>(null);
  const [editing, setEditing] = useState<ApplicationRecord | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active");
  const load = async () => {
    const [a, r, c] = await Promise.all([
      client.get("/applications"),
      client.get("/resume"),
      client.get("/companies"),
    ]);
    setCompanies(c.data);
    setRecords(a.data);
    setResumes(r.data);
  };
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const company = companies.find((c) => c.id === params.get("company"));
    if (company)
      setDraft({
        ...empty,
        company_id: company.id,
        company_name: company.data.name,
        company_description: company.data.description,
        skills: company.data.skills || [],
      });
  }, [companies, params]);
  const selected = records.find((r) => r.id === params.get("id"));
  const change = (key: keyof ApplicationFields, value: string | string[]) =>
    setDraft((d) => ({
      ...d!,
      [key]: value,
      ...(key === "company_name" ? { company_id: "" } : {}),
    }));
  const edit = (record: ApplicationRecord | null) => {
    setEditing(record);
    setDraft(record ? { ...empty, ...record.data } : { ...empty });
    setError("");
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const data = {
        ...draft,
        revision: editing?.revision || 0,
        source_url: draft.source_url || null,
        resume_id: draft.resume_id || null,
        company_id: draft.company_id || null,
        follow_up: draft.follow_up || null,
      };
      // Only editable fields cross the boundary; server-derived context stays server-side.
      const payload = Object.fromEntries(
        Object.keys({ ...empty, revision: 0 }).map((k) => [k, data[k]]),
      );
      const r = editing
        ? await client.put(`/applications/${editing.id}`, payload)
        : await client.post("/applications", payload);
      await load();
      setParams({ id: r.data.id });
      setDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const visible = records.filter(
    (r) =>
      (filter === "all" ||
        (filter === "active"
          ? !["archived", "rejected", "offer"].includes(r.data.status)
          : r.data.status === filter)) &&
      `${r.data.name} ${r.data.company_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{tr("copy.c148")}</h1>
            <p className="text-muted-foreground mt-2">{tr("copy.c149")}</p>
          </div>
          <Button onClick={() => edit(null)}>
            <Plus className="h-4 w-4 mr-2" />
            {tr("copy.c150")}
          </Button>
        </header>
        {error && (
          <p role="alert" className="text-destructive">
            {error}{" "}
            <Button
              variant="link"
              onClick={() =>
                load()
                  .then(() => setError(""))
                  .catch((e) => setError(e.message))
              }
            >
              {tr("copy.c151")}
            </Button>
          </p>
        )}
        {draft ? (
          <form
            onSubmit={save}
            className="border rounded-xl p-5 space-y-4"
            aria-label={tr("copy.c152")}
          >
            <h2 className="text-xl font-semibold">
              {editing ? tr("copy.c153") : tr("copy.c154")}
            </h2>
            <VacancyImport
              onImport={(fields) =>
                setDraft((d) => ({ ...d!, ...fields, company_id: "" }))
              }
            />
            <label className="block">
              {tr("copy.c155")}
              <select
                aria-label={tr("copy.c155")}
                className="block w-full"
                value={draft.company_id || ""}
                onChange={(e) => {
                  const c = companies.find((c) => c.id === e.target.value);
                  setDraft((d) => ({
                    ...d!,
                    company_id: c?.id || "",
                    company_name: c?.data.name || "",
                    company_description: c?.data.description || "",
                    skills: c?.data.skills?.length ? c.data.skills : d!.skills,
                  }));
                }}
              >
                <option value="">{tr("copy.c156")}</option>
                {companies
                  .filter((c) => !c.data.archived || c.id === draft.company_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.data.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ["name", tr("copy.c089")],
                ["company_name", tr("copy.c069")],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Input
                    required
                    minLength={key === "company_name" ? 2 : 3}
                    maxLength={200}
                    value={draft[key] || ""}
                    onChange={(e) =>
                      change(key as keyof ApplicationFields, e.target.value)
                    }
                  />
                </label>
              ))}
            </div>
            <label className="block">
              {tr("copy.c157")}
              <Textarea
                aria-label={tr("copy.c157")}
                required
                minLength={10}
                maxLength={10000}
                rows={5}
                value={draft.description}
                onChange={(e) => change("description", e.target.value)}
              />
            </label>
            <label className="block">
              {tr("copy.c158")}
              <Input
                type="url"
                placeholder="https://…"
                value={draft.source_url || ""}
                onChange={(e) => change("source_url", e.target.value)}
              />
            </label>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                ["location", tr("copy.c073")],
                ["employment", tr("copy.c159")],
                ["salary", tr("copy.c160")],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Input
                    maxLength={key === "employment" ? 200 : 300}
                    value={draft[key] || ""}
                    onChange={(e) =>
                      change(key as keyof ApplicationFields, e.target.value)
                    }
                  />
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ["requirements", tr("copy.c161")],
                ["responsibilities", tr("copy.c133")],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Textarea
                    aria-label={label}
                    value={(draft[key] || []).join("\n")}
                    onChange={(e) =>
                      change(
                        key as keyof ApplicationFields,
                        e.target.value.split("\n").slice(0, 30),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <p className="font-medium">{tr("copy.c162")}</p>
            <SkillPicker
              placeholder={tr("copy.c064")}
              selected={draft.skills}
              onChange={(v) => change("skills", v)}
            />
            <div className="flex flex-wrap gap-2">
              {draft.skills.map((s) => (
                <Button
                  type="button"
                  key={s}
                  variant="secondary"
                  onClick={() =>
                    change(
                      "skills",
                      draft.skills.filter((v) => v !== s),
                    )
                  }
                >
                  {s} ×
                </Button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                {tr("copy.c163")}
                <select
                  aria-label={tr("copy.c163")}
                  className="block w-full p-2 border rounded bg-background"
                  value={draft.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {Object.entries(stages).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("copy.c164")}
                <select
                  aria-label={tr("copy.c164")}
                  className="block w-full p-2 border rounded bg-background"
                  value={draft.resume_id || ""}
                  onChange={(e) => change("resume_id", e.target.value)}
                >
                  <option value="">{tr("copy.c165")}</option>
                  {resumes.map((r) => (
                    <option key={r.resume_id} value={r.resume_id}>
                      {r.title || r.filename}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                {tr("copy.c166")}
                <Input
                  maxLength={500}
                  placeholder={tr("copy.c167")}
                  value={draft.next_action}
                  onChange={(e) => change("next_action", e.target.value)}
                />
              </label>
              <label>
                {tr("copy.c168")}
                <Input
                  type="date"
                  value={draft.follow_up || ""}
                  onChange={(e) => change("follow_up", e.target.value)}
                />
              </label>
            </div>
            <label className="block">
              {tr("copy.c169")}
              <Textarea
                maxLength={5000}
                value={draft.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
            <p className="text-sm text-muted-foreground">{tr("copy.c170")}</p>
            <div className="flex gap-3">
              <Button disabled={busy}>
                {busy ? tr("copy.c171") : tr("copy.c172")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                {tr("copy.c023")}
              </Button>
            </div>
          </form>
        ) : null}
        {selected && !draft ? (
          <section
            aria-label={tr("copy.c173")}
            className="border border-primary/30 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selected.data.company_name} · {stages[selected.data.status]}
                </p>
                <h2 className="text-2xl font-semibold">{selected.data.name}</h2>
              </div>
              <Button variant="outline" onClick={() => edit(selected)}>
                {tr("copy.c153")}
              </Button>
            </div>
            <div className="rounded-lg bg-primary/5 p-4">
              <p className="font-semibold">{tr("copy.c174")}</p>
              <p>
                {selected.next_step_key && selected.next_step_key !== "custom"
                  ? tr("nextStep." + selected.next_step_key)
                  : selected.next_step}
              </p>
              {selected.data.follow_up && (
                <p className="mt-2 text-sm">
                  {tr("copy.c175")} {selected.data.follow_up}
                  {selected.data.follow_up < localDate ? tr("copy.c176") : ""}
                </p>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words">
              {selected.data.description}
            </p>
            <p className="text-sm text-muted-foreground">
              {[
                selected.data.location,
                selected.data.employment,
                selected.data.salary,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {["requirements", "responsibilities"].map((key) =>
              selected.data[key]?.length ? (
                <div key={key}>
                  <h3 className="font-semibold">
                    {key === "requirements" ? tr("copy.c161") : tr("copy.c133")}
                  </h3>
                  <ul className="list-disc pl-5">
                    {selected.data[key].map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
            {selected.data.company_id && (
              <Link
                className="text-primary underline block"
                to={`/companies?id=${selected.data.company_id}`}
              >
                {tr("copy.c177")}
              </Link>
            )}
            {selected.data.source_url && (
              <a
                href={selected.data.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {tr("copy.c178")}
              </a>
            )}
            {selected.resume_title && (
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to={`/resume/${selected.data.resume_id}/edit`}>
                    {tr("copy.c179")}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/resume/${selected.data.resume_id}/generate`}>
                    {tr("copy.c180")}
                  </Link>
                </Button>
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  title: tr("copy.c181"),
                  body: selected.resume_title || tr("copy.c182"),
                  to: selected.resume_title
                    ? `/resume/${selected.data.resume_id}/improve?vacancy=${selected.id}`
                    : `/resume/new?vacancy=${selected.id}`,
                  action: selected.resume_title
                    ? tr("copy.c183")
                    : tr("copy.c184"),
                },
                {
                  title: tr("copy.c185"),
                  body: tr("dynamic.practiceCount", {
                    count: selected.interviews.length,
                  }),
                  to: `/interview/start?vacancy=${selected.id}`,
                  action: tr("copy.c186"),
                },
                {
                  title: tr("copy.c187"),
                  body: tr("copy.c188"),
                  to: `/plan?vacancy=${selected.id}`,
                  action: tr("copy.c067"),
                },
              ].map((x) => (
                <article
                  key={x.title}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <h3 className="font-semibold">{x.title}</h3>
                  <p className="text-sm text-muted-foreground">{x.body}</p>
                  <Link
                    className="inline-flex items-center gap-2 text-primary underline"
                    to={x.to}
                  >
                    {x.action}
                    <ArrowRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
            {selected.interviews.length > 0 && (
              <div>
                <h3 className="font-semibold">{tr("copy.c189")}</h3>
                {selected.interviews.map((i, n) => (
                  <Link
                    key={i.id}
                    className="block text-primary underline py-1"
                    to={`/interview/${i.finished ? "summary" : i.mode === "voice" ? "voice" : "session"}?id=${i.id}`}
                  >
                    {tr("copy.c190")} {selected.interviews.length - n} ·{" "}
                    {i.finished
                      ? tr("dynamic.score", { score: i.score })
                      : tr("copy.c191")}
                  </Link>
                ))}
              </div>
            )}
            {selected.plans.map((p) => (
              <Link
                key={p.id}
                className="block text-primary underline"
                to={`/plan/${p.id}`}
              >
                {tr("copy.c192")} {p.goal}
              </Link>
            ))}
            {selected.data.notes && (
              <div>
                <h3 className="font-semibold">{tr("copy.c193")}</h3>
                <p className="whitespace-pre-wrap break-words">
                  {selected.data.notes}
                </p>
              </div>
            )}
          </section>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Input
            aria-label={tr("copy.c194")}
            className="sm:max-w-sm"
            placeholder={tr("copy.c195")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label={tr("copy.c196")}
            className="border rounded p-2 bg-background"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="active">{tr("copy.c197")}</option>
            <option value="all">{tr("copy.c198")}</option>
            {Object.entries(stages).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p role="status">{tr("copy.c199")}</p>
        ) : visible.length === 0 ? (
          <section className="border border-dashed rounded-xl p-8 text-center space-y-3">
            <BriefcaseBusiness className="mx-auto h-9 w-9 text-primary" />
            <h2 className="text-xl font-semibold">
              {records.length ? tr("copy.c200") : tr("copy.c201")}
            </h2>
            <p className="text-muted-foreground">{tr("copy.c202")}</p>
            <Button variant="outline" onClick={() => edit(null)}>
              {tr("copy.c203")}
            </Button>
          </section>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {visible.map((r) => (
              <button
                key={r.id}
                className={`text-left border rounded-xl p-5 space-y-2 hover:border-primary ${selected?.id === r.id ? "border-primary" : ""}`}
                onClick={() => {
                  setParams({ id: r.id });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <div className="text-sm text-muted-foreground">
                  {r.data.company_name} · {stages[r.data.status]}
                </div>
                <h2 className="font-semibold text-lg break-words">
                  {r.data.name}
                </h2>
                <p className="text-sm">
                  {r.next_step_key && r.next_step_key !== "custom"
                    ? tr("nextStep." + r.next_step_key)
                    : r.next_step}
                </p>
                {r.data.follow_up && (
                  <p className="text-sm text-primary">
                    {tr("copy.c055")} {r.data.follow_up}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
