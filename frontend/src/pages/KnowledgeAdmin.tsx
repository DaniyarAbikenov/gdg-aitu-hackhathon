import { useEffect, useState } from "react";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArticleBody } from "@/components/ArticleBody";
import type { KnowledgeArticle } from "./FAQ";
const empty = {
  id: "",
  title: "",
  category: "",
  body: "",
  published: false,
  revision: 0,
  updated_at: "",
};
export default function KnowledgeAdmin() {
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
    if (!dirty || window.confirm("Отменить несохранённые изменения?")) {
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
      setMessage(
        r.data.published ? "Статья опубликована" : "Черновик сохранён",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <h1 className="text-3xl font-bold">Редактор базы знаний</h1>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {allowed && (
          <div className="grid md:grid-cols-[260px_1fr] gap-6">
            <aside className="space-y-2">
              <Button disabled={busy} onClick={() => choose(empty)}>
                Новая статья
              </Button>
              {articles.map((a) => (
                <button
                  className="block text-left border rounded p-3 w-full"
                  key={a.id}
                  onClick={() => choose(a)}
                >
                  <strong>{a.title}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {a.published ? "Опубликована" : "Черновик"}
                  </span>
                </button>
              ))}
            </aside>
            <section className="space-y-4">
              <label className="block">
                Заголовок
                <Input
                  value={article.title}
                  maxLength={200}
                  onChange={(e) => edit({ title: e.target.value })}
                />
              </label>
              <label className="block">
                Категория
                <Input
                  value={article.category}
                  maxLength={100}
                  onChange={(e) => edit({ category: e.target.value })}
                />
              </label>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPreview(!preview)}>
                  {preview ? "Редактировать текст" : "Предпросмотр"}
                </Button>
                <label className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={article.published}
                    onChange={(e) => edit({ published: e.target.checked })}
                  />
                  Публиковать
                </label>
              </div>
              {preview ? (
                <ArticleBody body={article.body} />
              ) : (
                <label className="block space-y-2">
                  Текст статьи
                  <Textarea
                    className="min-h-96"
                    maxLength={50000}
                    value={article.body}
                    onChange={(e) => edit({ body: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">
                    Разделяйте абзацы пустой строкой. Для заголовка раздела
                    используйте ##. HTML не выполняется.
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
                {busy ? "Сохранение…" : "Сохранить статью"}
              </Button>
              {message && <p role="status">{message}</p>}
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
