import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthCard } from "../components/AuthCard";
import { takeLinkToken, useVerifyEmail } from "../api";
import { useAuthStore } from "../store";

export default function VerifyEmail() {
  useLocale();
  const [token] = useState(takeLinkToken);
  const verify = useVerifyEmail();
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const { mutate } = verify;

  useEffect(() => {
    if (token) mutate(token);
  }, [token, mutate]);

  return (
    <AuthCard title={tr("verify.title")}>
      {!token ? (
        <p role="alert">{tr("recovery.noToken")}</p>
      ) : verify.isSuccess ? (
        <p role="status">{tr("verify.done")}</p>
      ) : verify.error ? (
        <p role="alert" className="text-destructive">
          {getErrorMessage(verify.error)}
        </p>
      ) : (
        <p role="status">{tr("verify.checking")}</p>
      )}
      <Button asChild variant="outline" className="w-full">
        <Link to={signedIn ? "/settings" : "/login"}>
          {signedIn ? tr("verify.toSettings") : tr("recovery.backToLogin")}
        </Link>
      </Button>
    </AuthCard>
  );
}
