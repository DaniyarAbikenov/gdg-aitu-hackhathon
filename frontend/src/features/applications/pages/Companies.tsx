import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Building2, Plus, X } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SkillPicker } from "@/components/SkillPicker";
import type { CompanyPayload } from "@/api/types";
import { useCompanies, useSaveCompany } from "../api";
import { CompanyResearch } from "../components/CompanyResearch";
import { InterviewReports } from "../components/InterviewReports";
import type { Assignment, CompanyData, CompanyRecord } from "../types";
const blank: CompanyData = {
  name: "",
  description: "",
  website: "",
  location: "",
  skills: [],
  hiring_process: "",
  notes: "",
  assignments: [],
  archived: false,
};
export default function Companies() {
  useLocale();
  const [params, setParams] = useSearchParams();
  const companies = useCompanies();
  const saveCompany = useSaveCompany();
  const records = companies.data ?? [];
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [draft, setDraft] = useState<CompanyData | null>(null);
  const [editing, setEditing] = useState<CompanyRecord | null>(null);
  const [saveError, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loading = companies.isPending;
  const error =
    saveError || (companies.error ? getErrorMessage(companies.error) : "");
  const selected = records.find((r) => r.id === params.get("id"));
  const edit = (r: CompanyRecord | null) => {
    setEditing(r);
    // Website research is kept by the server; the form never sends it back.
    const { research: _research, ...data } = r?.data ?? {};
    setDraft({ ...blank, ...data });
    setError("");
  };
  const update = (key: keyof CompanyData, value: unknown) =>
    setDraft((d) => ({ ...d!, [key]: value }));
  const assignment = (index: number, key: keyof Assignment, value: string) =>
    update(
      "assignments",
      draft!.assignments.map((a, i) =>
        i === index ? { ...a, [key]: value } : a,
      ),
    );
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload: CompanyPayload = {
        ...draft!,
        website: draft!.website || null,
        assignments: draft!.assignments.map((a) => ({
          ...a,
          source_url: a.source_url || null,
        })),
        revision: editing?.revision || 0,
      };
      const r = await saveCompany.mutateAsync({ id: editing?.id, payload });
      setParams({ id: r.id });
      setDraft(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="studio-page max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
        <header className="page-heading flex flex-wrap justify-between gap-4 items-end">
          <div>
            <p className="eyebrow">{tr("copy.c204")}</p>
            <h1 className="text-4xl font-bold">{tr("copy.c205")}</h1>
            <p className="text-muted-foreground mt-3 max-w-xl">
              {tr("copy.c206")}
            </p>
          </div>
          <Button onClick={() => edit(null)}>
            <Plus size={17} className="mr-2" />
            {tr("copy.c207")}
          </Button>
        </header>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {draft ? (
          <form
            aria-label={tr("copy.c208")}
            onSubmit={save}
            className="paper-panel p-5 sm:p-8 space-y-5"
          >
            <h2 className="text-2xl font-semibold">
              {editing ? tr("copy.c209") : tr("copy.c156")}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                {tr("copy.c210")}
                <Input
                  required
                  minLength={2}
                  maxLength={200}
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </label>
              <label>
                {tr("copy.c211")}
                <Input
                  type="url"
                  placeholder="https://…"
                  value={draft.website || ""}
                  onChange={(e) => update("website", e.target.value)}
                />
              </label>
            </div>
            <label className="block">
              {tr("copy.c212")}
              <Textarea
                aria-label={tr("copy.c212")}
                maxLength={3000}
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </label>
            <label className="block">
              {tr("copy.c073")}
              <Input
                maxLength={300}
                value={draft.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </label>
            <div>
              <h3 className="font-semibold mb-2">{tr("copy.c213")}</h3>
              <SkillPicker
                selected={draft.skills}
                onChange={(s) => update("skills", s)}
                placeholder={tr("copy.c064")}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {draft.skills.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      update(
                        "skills",
                        draft.skills.filter((x) => x !== s),
                      )
                    }
                  >
                    {s}
                    <X size={14} className="ml-2" />
                  </Button>
                ))}
              </div>
            </div>
            <label className="block">
              {tr("copy.c214")}
              <Textarea
                maxLength={5000}
                placeholder={tr("copy.c215")}
                value={draft.hiring_process}
                onChange={(e) => update("hiring_process", e.target.value)}
              />
            </label>
            <section className="space-y-4">
              <h3 className="text-xl font-semibold">{tr("copy.c216")}</h3>
              <p className="text-sm text-muted-foreground">{tr("copy.c217")}</p>
              {draft.assignments.map((a, i) => (
                <fieldset key={i} className="assignment-note space-y-3 p-4">
                  <legend className="font-medium">{i + 1}</legend>
                  <label className="block">
                    {tr("copy.c218")}
                    <Input
                      required
                      maxLength={200}
                      value={a.title}
                      onChange={(e) => assignment(i, "title", e.target.value)}
                    />
                  </label>
                  <label className="block">
                    {tr("copy.c219")}
                    <Textarea
                      maxLength={5000}
                      rows={4}
                      value={a.description}
                      onChange={(e) =>
                        assignment(i, "description", e.target.value)
                      }
                    />
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label>
                      {tr("copy.c220")}
                      <Input
                        type="url"
                        value={a.source_url || ""}
                        onChange={(e) =>
                          assignment(i, "source_url", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      {tr("copy.c221")}
                      <select
                        className="block w-full"
                        value={a.kind}
                        onChange={(e) => assignment(i, "kind", e.target.value)}
                      >
                        <option value="practice">{tr("copy.c222")}</option>
                        <option value="employer">{tr("copy.c223")}</option>
                      </select>
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      update(
                        "assignments",
                        draft.assignments.filter((_, n) => n !== i),
                      )
                    }
                  >
                    {tr("copy.c224")}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={draft.assignments.length >= 30}
                onClick={() =>
                  update("assignments", [
                    ...draft.assignments,
                    {
                      title: "",
                      description: "",
                      source_url: "",
                      kind: "practice",
                    },
                  ])
                }
              >
                {tr("copy.c225")}
              </Button>
            </section>
            <label className="block">
              {tr("copy.c169")}
              <Textarea
                maxLength={5000}
                value={draft.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.archived}
                onChange={(e) => update("archived", e.target.checked)}
              />
              {tr("copy.c226")}
            </label>
            <div className="flex gap-3">
              <Button disabled={busy}>
                {busy ? tr("copy.c171") : tr("copy.c227")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                {tr("copy.c023")}
              </Button>
            </div>
          </form>
        ) : selected ? (
          <section
            className="paper-panel p-5 sm:p-8 space-y-6"
            aria-label={tr("copy.c228")}
          >
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="eyebrow">{selected.data.location}</p>
                <h2 className="text-3xl font-semibold">{selected.data.name}</h2>
              </div>
              <Button variant="outline" onClick={() => edit(selected)}>
                {tr("copy.c209")}
              </Button>
            </div>
            <p className="whitespace-pre-wrap">{selected.data.description}</p>
            {selected.data.website && (
              <a
                className="inline-flex gap-2 text-primary underline"
                href={selected.data.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tr("copy.c211")}
                <ArrowUpRight size={16} />
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              {selected.data.skills?.map((s) => (
                <span className="skill-stamp" key={s}>
                  {s}
                </span>
              ))}
            </div>
            {selected.data.hiring_process && (
              <div>
                <h3 className="font-semibold mb-2">{tr("copy.c214")}</h3>
                <p className="whitespace-pre-wrap">
                  {selected.data.hiring_process}
                </p>
              </div>
            )}
            <section className="space-y-3">
              <h3 className="text-xl font-semibold">{tr("copy.c216")}</h3>
              {selected.data.assignments?.length ? (
                selected.data.assignments.map((a, i) => (
                  <article className="assignment-note p-5 space-y-2" key={i}>
                    <p className="eyebrow">
                      {a.kind === "employer"
                        ? tr("copy.c223")
                        : tr("copy.c222")}
                    </p>
                    <h4 className="font-semibold text-lg">{a.title}</h4>
                    <p className="whitespace-pre-wrap">{a.description}</p>
                    {a.source_url && (
                      <a
                        className="text-primary underline"
                        href={a.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tr("copy.c229")}
                      </a>
                    )}
                  </article>
                ))
              ) : (
                <p className="text-muted-foreground">{tr("copy.c230")}</p>
              )}
            </section>
            <CompanyResearch company={selected} />
            <InterviewReports key={selected.id} companyId={selected.id} />
            {selected.data.notes && (
              <div>
                <h3 className="font-semibold">{tr("copy.c169")}</h3>
                <p className="whitespace-pre-wrap">{selected.data.notes}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to={`/interview/start?company=${selected.id}`}>
                  {tr("copy.c231")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/applications?company=${selected.id}`}>
                  {tr("copy.c232")}
                </Link>
              </Button>
            </div>
            {!!selected.vacancy_ids?.length && (
              <div className="space-y-2">
                <h3 className="font-semibold">{tr("copy.c233")}</h3>
                {selected.vacancy_ids.map((id, i) => (
                  <Link
                    className="block text-primary underline"
                    key={id}
                    to={`/applications?id=${id}`}
                  >
                    {tr("copy.c234")} {i + 1} ↗
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <Input
            className="sm:max-w-md"
            aria-label={tr("copy.c235")}
            placeholder={tr("copy.c236")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="flex gap-2 items-center text-sm">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            {tr("copy.c237")}
          </label>
        </div>
        {loading ? (
          <p role="status">{tr("copy.c000")}</p>
        ) : (
          <div className="company-shelf">
            {records
              .filter(
                (r) =>
                  (archived || !r.data.archived) &&
                  `${r.data.name} ${r.data.skills?.join(" ")} ${r.data.location}`
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
              )
              .map((r, i) => (
                <button
                  key={r.id}
                  className="company-cover text-left p-6 space-y-4"
                  data-tone={i % 3}
                  onClick={() => {
                    setParams({ id: r.id });
                    setDraft(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="company-monogram">
                      {r.data.name.slice(0, 2).toUpperCase()}
                    </span>
                    <ArrowUpRight />
                  </div>
                  <h2 className="text-2xl font-semibold break-words">
                    {r.data.name}
                  </h2>
                  <p className="text-sm line-clamp-2">{r.data.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.data.skills?.slice(0, 5).map((s) => (
                      <span key={s} className="skill-stamp">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm">
                    {r.data.assignments?.length || 0} {tr("copy.c238")}
                  </p>
                </button>
              ))}
          </div>
        )}
        {!loading && !records.length && (
          <section className="paper-panel p-10 text-center space-y-4">
            <Building2 className="mx-auto" size={38} />
            <h2 className="text-2xl font-semibold">{tr("copy.c239")}</h2>
            <p className="text-muted-foreground">{tr("copy.c240")}</p>
            <Button onClick={() => edit(null)}>{tr("copy.c241")}</Button>
          </section>
        )}
      </div>
    </MainLayout>
  );
}
