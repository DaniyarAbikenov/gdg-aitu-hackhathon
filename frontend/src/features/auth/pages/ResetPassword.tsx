import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "../components/AuthCard";
import { takeLinkToken, useResetPassword } from "../api";
import { useAuthStore } from "../store";

export default function ResetPassword() {
  useLocale();
  const [token] = useState(takeLinkToken);
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMismatch(password !== repeat);
    if (password !== repeat) return;
    const ok = await reset
      .mutateAsync({ token, password })
      .then(() => true)
      .catch(() => false);
    if (!ok) return;
    // Every session was signed out with the old password.
    useAuthStore.getState().setUnauthenticated();
    setDone(true);
  };

  if (done) {
    return (
      <AuthCard title={tr("recovery.resetTitle")}>
        <p role="status">{tr("recovery.resetDone")}</p>
        <Button asChild className="w-full">
          <Link to="/login">{tr("recovery.backToLogin")}</Link>
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={tr("recovery.resetTitle")}>
      {!token ? (
        <p role="alert">{tr("recovery.noToken")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{tr("recovery.newPassword")}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {tr("recovery.passwordRule")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password2">{tr("recovery.repeatPassword")}</Label>
            <Input
              id="password2"
              type="password"
              required
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </div>
          {(mismatch || reset.error) && (
            <p role="alert" className="text-destructive">
              {mismatch
                ? tr("recovery.mismatch")
                : getErrorMessage(reset.error)}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={reset.isPending}>
            {tr("recovery.save")}
          </Button>
        </form>
      )}
      <Link
        to="/forgot-password"
        className="block text-center text-sm text-primary"
      >
        {tr("recovery.requestAgain")}
      </Link>
    </AuthCard>
  );
}
