import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "../components/AuthCard";
import { useAuthOptions, useForgotPassword } from "../api";

export default function ForgotPassword() {
  useLocale();
  const options = useAuthOptions();
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");
  const unavailable = options.data && !options.data.email;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    forgot.mutate(email.trim());
  };

  return (
    <AuthCard title={tr("recovery.forgotTitle")}>
      {unavailable ? (
        <p role="status">{tr("recovery.unavailable")}</p>
      ) : forgot.isSuccess ? (
        <p role="status">{tr("recovery.sent")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {tr("recovery.forgotExplain")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {forgot.error && (
            <p role="alert" className="text-destructive">
              {getErrorMessage(forgot.error)}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={forgot.isPending}>
            {tr("recovery.send")}
          </Button>
        </form>
      )}
      <Link to="/login" className="block text-center text-sm text-primary">
        {tr("recovery.backToLogin")}
      </Link>
    </AuthCard>
  );
}
