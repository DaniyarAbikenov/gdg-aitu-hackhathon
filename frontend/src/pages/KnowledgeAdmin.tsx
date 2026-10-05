import { tr, useLocale } from "@/i18n/copy";
import { useEffect, useState } from "react";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArticleBody } from "@/components/ArticleBody";
import type { KnowledgeArticle } from "./FAQ";
const empty = {
  language: "ru",
  id: "",
  title: "",
  category: "",
  body: "",
  published: false,
  revision: 0,
  updated_at: "",
};
export default function KnowledgeAdmin() {
  useLocale();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [article, setArticle] = useState(empty);
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    client
      .get("/admin/knowledge")
      .then((r) => {
        setArticles(r.data);
        setAllowed(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const edit = (patch: Partial<KnowledgeArticle>) => {
    setArticle({ ...article, ...patch });
    setDirty(true);
    setMessage("");
  };
  const choose = (a: KnowledgeArticle) => {
    if (!dirty || window.confirm(tr("copy.c348"))) {
      setArticle(a);
      setDirty(false);
      setMessage("");
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const { id, updated_at, ...payload } = article;
      const r = id
        ? await client.put(`/admin/knowledge/${id}`, payload)
        : await client.post("/admin/knowledge", payload);
      setArticle(r.data);
      setArticles([r.data, ...articles.filter((a) => a.id !== r.data.id)]);
      setDirty(false);
      setMessage(r.data.published ? tr("copy.c349") : tr("copy.c350"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <h1 className="text-3xl font-bold">{tr("copy.c351")}</h1>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {allowed && (
          <div className="grid md:grid-cols-[260px_1fr] gap-6">
            <aside className="space-y-2">
              <Button disabled={busy} onClick={() => choose(empty)}>
                {tr("copy.c352")}
              </Button>
              {articles.map((a) => (
                <button
                  className="block text-left border rounded p-3 w-full"
                  key={a.id}
                  onClick={() => choose(a)}
                >
                  <strong>{a.title}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {a.published ? tr("copy.c353") : tr("copy.c354")}
                  </span>
                </button>
              ))}
            </aside>
            <section className="space-y-4">
              <label className="block">
                {tr("articleLanguage")}
                <select
                  value={article.language}
                  onChange={(e) => edit({ language: e.target.value })}
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="kk">Қазақша</option>
                </select>
              </label>
              <label className="block">
                {tr("copy.c355")}
                <Input
                  value={article.title}
                  maxLength={200}
                  onChange={(e) => edit({ title: e.target.value })}
                />
              </label>
              <label className="block">
                {tr("copy.c356")}
                <Input
                  value={article.category}
                  maxLength={100}
                  onChange={(e) => edit({ category: e.target.value })}
                />
              </label>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPreview(!preview)}>
                  {preview ? tr("copy.c357") : tr("copy.c358")}
                </Button>
                <label className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={article.published}
                    onChange={(e) => edit({ published: e.target.checked })}
                  />
                  {tr("copy.c359")}
                </label>
              </div>
              {preview ? (
                <ArticleBody body={article.body} />
              ) : (
                <label className="block space-y-2">
                  {tr("copy.c360")}
                  <Textarea
                    className="min-h-96"
                    maxLength={50000}
                    value={article.body}
                    onChange={(e) => edit({ body: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {tr("copy.c361")}
                  </span>
                </label>
              )}
              <Button
                disabled={
                  busy ||
                  article.title.trim().length < 3 ||
                  !article.category.trim() ||
                  article.body.trim().length < 20
                }
                onClick={save}
              >
                {busy ? tr("copy.c109") : tr("copy.c362")}
              </Button>
              {message && <p role="status">{message}</p>}
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
