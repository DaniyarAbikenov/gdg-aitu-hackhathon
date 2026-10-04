import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArticleBody } from "@/components/ArticleBody";
export type KnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  body: string;
  published: boolean;
  revision: number;
  updated_at: string;
};
export default function FAQ() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const load = () => {
    setLoading(true);
    client
      .get("/knowledge")
      .then((r) => {
        setArticles(r.data);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
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
          <h1 className="text-3xl font-bold">База знаний</h1>
          <p className="text-muted-foreground mt-2">
            Как подготовить резюме, пройти тренировку и построить план развития.
          </p>
        </header>
        {error && (
          <p role="alert">
            {error} <Button onClick={load}>Повторить</Button>
          </p>
        )}
        {loading && <p role="status">Загрузка статей…</p>}
        {selected ? (
          <article className="rounded-xl border p-5 sm:p-8 space-y-5">
            <Button variant="ghost" onClick={() => setParams({})}>
              ← Все статьи
            </Button>
            <p className="text-sm text-primary">{selected.category}</p>
            <h1 className="text-2xl font-bold">{selected.title}</h1>
            <p className="text-sm text-muted-foreground">
              Обновлено {new Date(selected.updated_at).toLocaleDateString()} ·{" "}
              {Math.max(1, Math.ceil(selected.body.split(/\s+/).length / 180))}{" "}
              мин чтения
            </p>
            <ArticleBody body={selected.body} />
            <footer className="border-t pt-4">
              <h2 className="font-semibold">По этой теме</h2>
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
                aria-label="Поиск в базе знаний"
                placeholder="Найти ответ или инструкцию"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="Категория статей"
                className="border rounded p-2 bg-background"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Все темы</option>
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
            {!loading && !shown.length && (
              <p>
                Статей по этому запросу не найдено. Попробуйте другое слово.
              </p>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
