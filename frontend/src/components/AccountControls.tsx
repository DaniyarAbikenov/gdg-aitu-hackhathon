import { useState } from "react";
import client from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function AccountControls({
  passwordAccount,
}: {
  passwordAccount: boolean;
}) {
  const email = useAuthStore((s) => s.email);
  const [mode, setMode] = useState<"password" | "delete" | null>(null);
  const [password, setPassword] = useState(""),
    [next, setNext] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "delete")
        await client.post("/account/delete", { password, email: confirmation });
      else
        await client.post("/account/password", {
          password,
          new_password: next,
        });
      window.location.replace(
        `/login?account=${mode === "delete" ? "deleted" : "password-changed"}`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="border rounded-xl p-5 space-y-4">
      <h2 className="font-semibold">Данные и безопасность</h2>
      <p className="text-sm text-muted-foreground">
        Экспорт включает профиль, резюме, версии, вакансии, интервью и учебные
        планы. Пароли и ключи в выгрузку не входят.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <a href="/api/account/export">Скачать мои данные (JSON)</a>
        </Button>
        {passwordAccount && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setMode("password");
                setPassword("");
                setConfirmation("");
                setError("");
              }}
            >
              Сменить пароль
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                setMode("delete");
                setPassword("");
                setConfirmation("");
                setError("");
              }}
            >
              Удалить аккаунт
            </Button>
          </>
        )}
      </div>
      {mode && (
        <form
          onSubmit={submit}
          className="border rounded-lg p-4 space-y-4"
          aria-label={mode === "delete" ? "Удаление аккаунта" : "Смена пароля"}
        >
          <h3 className="font-semibold">
            {mode === "delete"
              ? "Удаление без возможности восстановления"
              : "Новый пароль и выход на всех устройствах"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {mode === "delete"
              ? "Личные данные в этом сервисе будут удалены: профиль, резюме, интервью, вакансии и планы. Общий каталог навыков и опубликованные статьи сохранятся. Сначала скачайте нужные материалы."
              : "После смены пароля все текущие сессии перестанут действовать. Войдите снова с новым паролем."}
          </p>
          <label className="block">
            Текущий пароль
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {mode === "password" ? (
            <label className="block">
              Новый пароль
              <Input
                type="password"
                autoComplete="new-password"
                aria-label="Новый пароль"
                required
                minLength={12}
                maxLength={256}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Не меньше 12 символов
              </span>
            </label>
          ) : (
            <label className="block">
              Введите email аккаунта для подтверждения
              <Input
                type="email"
                autoComplete="off"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant={mode === "delete" ? "destructive" : "default"}
              disabled={
                busy ||
                (mode === "delete" &&
                  confirmation.trim().toLowerCase() !== email)
              }
            >
              {busy
                ? "Выполняем…"
                : mode === "delete"
                  ? "Удалить мои данные и аккаунт"
                  : "Сохранить новый пароль"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setMode(null);
                setPassword("");
                setNext("");
              }}
            >
              Отмена
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
