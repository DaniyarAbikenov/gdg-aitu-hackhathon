import { tr, useLocale, displayLocale } from "@/i18n/copy";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArticleBody } from "../components/ArticleBody";
import { getErrorMessage } from "@/lib/errors";
import { usePublishedArticles } from "../api";
export default function FAQ() {
  const { i18n } = useLocale();
  const language = i18n.language === "kz" ? "kk" : i18n.language;
  const knowledge = usePublishedArticles(language);
  const articles = knowledge.data ?? [];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const error = knowledge.error ? getErrorMessage(knowledge.error) : "";
  const loading = knowledge.isFetching;
  const load = () => void knowledge.refetch();
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    setCategory("");
  }, [language]);
  const selected = articles.find((a) => a.id === params.get("article"));
  const shown = articles.filter(
    (a) =>
      (!category || a.category === category) &&
      `${a.title} ${a.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-bold">{tr("copy.c126")}</h1>
          <p className="text-muted-foreground mt-2">{tr("copy.c283")}</p>
        </header>
        {error && (
          <p role="alert">
            {error} <Button onClick={load}>{tr("copy.c252")}</Button>
          </p>
        )}
        {loading && <p role="status">{tr("copy.c284")}</p>}
        {selected ? (
          <article className="rounded-xl border p-5 sm:p-8 space-y-5">
            <Button variant="ghost" onClick={() => setParams({})}>
              {tr("copy.c285")}
            </Button>
            <p className="text-sm text-primary">{selected.category}</p>
            <h1 className="text-2xl font-bold">{selected.title}</h1>
            <p className="text-sm text-muted-foreground">
              {tr("copy.c286")}{" "}
              {new Date(selected.updated_at).toLocaleDateString(
                displayLocale(),
              )}{" "}
              ·{" "}
              {Math.max(1, Math.ceil(selected.body.split(/\s+/).length / 180))}{" "}
              {tr("copy.c287")}
            </p>
            <ArticleBody body={selected.body} />
            <footer className="border-t pt-4">
              <h2 className="font-semibold">{tr("copy.c288")}</h2>
              {articles
                .filter(
                  (a) =>
                    a.category === selected.category && a.id !== selected.id,
                )
                .map((a) => (
                  <Link
                    className="block text-primary underline mt-2"
                    key={a.id}
                    to={`/faq?article=${a.id}`}
                  >
                    {a.title}
                  </Link>
                ))}
            </footer>
          </article>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label={tr("copy.c289")}
                placeholder={tr("copy.c290")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label={tr("copy.c291")}
                className="border rounded p-2 bg-background"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">{tr("copy.c292")}</option>
                {[...new Set(articles.map((a) => a.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {shown.map((a) => (
                <Link
                  to={`/faq?article=${a.id}`}
                  key={a.id}
                  className="rounded-xl border p-5 space-y-2 hover:bg-muted/50"
                >
                  <p className="text-sm text-primary">{a.category}</p>
                  <h2 className="text-lg font-semibold">{a.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {a.body.replace(/^## /, "").slice(0, 160)}…
                  </p>
                </Link>
              ))}
            </div>
            {!loading && !shown.length && <p>{tr("copy.c293")}</p>}
          </>
        )}
      </div>
    </MainLayout>
  );
}
