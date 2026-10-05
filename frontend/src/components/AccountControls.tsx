import { tr, useLocale } from "@/i18n/copy";
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
  useLocale();
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
      <h2 className="font-semibold">{tr("copy.c005")}</h2>
      <p className="text-sm text-muted-foreground">{tr("copy.c006")}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <a href="/api/account/export">{tr("copy.c007")}</a>
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
              {tr("copy.c008")}
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
              {tr("copy.c009")}
            </Button>
          </>
        )}
      </div>
      {mode && (
        <form
          onSubmit={submit}
          className="border rounded-lg p-4 space-y-4"
          aria-label={mode === "delete" ? tr("copy.c010") : tr("copy.c011")}
        >
          <h3 className="font-semibold">
            {mode === "delete" ? tr("copy.c012") : tr("copy.c013")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {mode === "delete" ? tr("copy.c014") : tr("copy.c015")}
          </p>
          <label className="block">
            {tr("copy.c016")}
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
              {tr("copy.c017")}
              <Input
                type="password"
                autoComplete="new-password"
                aria-label={tr("copy.c017")}
                required
                minLength={12}
                maxLength={256}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                {tr("copy.c018")}
              </span>
            </label>
          ) : (
            <label className="block">
              {tr("copy.c019")}
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
                ? tr("copy.c020")
                : mode === "delete"
                  ? tr("copy.c021")
                  : tr("copy.c022")}
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
              {tr("copy.c023")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
