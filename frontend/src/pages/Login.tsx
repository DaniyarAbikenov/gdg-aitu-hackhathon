import { tr, useLocale } from "@/i18n/copy";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { loginWithEmail, loginWithGoogle } from "@/api/auth";

import client from "@/api/client";

export default function Login() {
  useLocale();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    client
      .get("/auth/options")
      .then(({ data }) => setGoogleEnabled(data.google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: t("common.error"),
        description: t("login.fillAll") ?? tr("copy.c377"),
        variant: "destructive",
      });
      return;
    }
    try {
      setSubmitting(true);
      await loginWithEmail(email, password);
      toast({
        title: t("login.success") ?? tr("copy.c378"),
        description: t("login.redirect") ?? tr("copy.c379"),
      });
      navigate("/dashboard");
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : tr("copy.c380"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    try {
      setSubmitting(true);
      await loginWithGoogle();
      toast({
        title: t("login.success") ?? tr("copy.c378"),
        description: t("login.redirect") ?? tr("copy.c379"),
      });
      navigate("/onboarding");
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : tr("copy.c381"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {t("login.title") ?? tr("copy.c382")}
          </CardTitle>
          <CardDescription>{`${t("app.name")} - ${t("app.tagline")}`}</CardDescription>
        </CardHeader>
        <CardContent>
          {new URLSearchParams(window.location.search).get("account") && (
            <p role="status" className="text-sm mb-4 text-primary">
              {new URLSearchParams(window.location.search).get("account") ===
              "deleted"
                ? tr("copy.c383")
                : tr("copy.c384")}
            </p>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("login.email") ?? "Email"}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {t("login.password") ?? tr("copy.c385")}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {t("login.signIn") ?? tr("copy.c296")}
            </Button>
            {googleEnabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onGoogle}
                disabled={submitting}
              >
                {t("login.signInGoogle") ?? tr("copy.c386")}
              </Button>
            )}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {t("login.noAccount") ?? tr("copy.c387")}{" "}
              </span>
              <Link to="/register" className="text-primary hover:underline">
                {t("login.registerNow") ?? tr("copy.c388")}
              </Link>
            </div>
            <div className="text-center text-sm">
              <Link
                to="/legal/policies"
                className="text-muted-foreground hover:text-primary"
              >
                {t("login.policies") ?? tr("copy.c389")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
