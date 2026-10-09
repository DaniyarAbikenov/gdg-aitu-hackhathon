import { tr, useLocale } from "@/i18n/copy";
import { useState } from "react";
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
import { registerWithEmail } from "@/api/auth";

export default function Register() {
  useLocale();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !password2) {
      toast({
        title: t("common.error"),
        description: t("login.fillAll") ?? tr("copy.c377"),
        variant: "destructive",
      });
      return;
    }
    if (password !== password2) {
      toast({
        title: t("common.error"),
        description: t("register.passwordMismatch") ?? tr("copy.c414"),
        variant: "destructive",
      });
      return;
    }
    if (password.length < 12) {
      toast({
        title: t("common.error"),
        description: t("register.passwordWeak"),
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      await registerWithEmail(email, password);
      toast({
        title: t("register.success") ?? tr("copy.c415"),
        description: t("login.redirect") ?? tr("copy.c379"),
      });
      navigate("/onboarding");
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : tr("copy.c416"),
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
            {t("register.title") ?? tr("copy.c417")}
          </CardTitle>
          <CardDescription>
            {t("register.subtitle") ??
              tr("dynamic.register", { app: t("app.name") })}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-2">
              <Label htmlFor="password2">
                {t("register.confirmPassword") ?? tr("copy.c418")}
              </Label>
              <Input
                id="password2"
                type="password"
                placeholder="••••••••"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {t("register.submit") ?? tr("copy.c419")}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {t("register.haveAccount") ?? tr("copy.c420")}{" "}
              </span>
              <Link to="/login" className="text-primary hover:underline">
                {t("login.signIn") ?? tr("copy.c296")}
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
