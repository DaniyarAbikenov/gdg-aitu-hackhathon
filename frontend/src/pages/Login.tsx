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
import { loginWithEmail, loginWithGoogle } from "@/api/auth";

export default function Login() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: t("common.error"),
        description: t("login.fillAll") ?? "Заполните все поля",
        variant: "destructive",
      });
      return;
    }
    try {
      setSubmitting(true);
      await loginWithEmail(email, password);
      toast({
        title: t("login.success") ?? "Вход выполнен",
        description: t("login.redirect") ?? "Перенаправление...",
      });
      navigate("/dashboard");
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err?.message ?? "Неверный email или пароль",
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
        title: t("login.success") ?? "Вход выполнен",
        description: t("login.redirect") ?? "Перенаправление...",
      });
      navigate("/onboarding");
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err?.message ?? "Не удалось войти через Google",
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
            {t("login.title") ?? "Вход"}
          </CardTitle>
          <CardDescription>{`${t("app.name")} - ${t("app.tagline")}`}</CardDescription>
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
                {t("login.password") ?? "Пароль"}
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
              {t("login.signIn") ?? "Войти"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onGoogle}
              disabled={submitting}
            >
              {t("login.signInGoogle") ?? "Войти через Google"}
            </Button>
            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {t("login.noAccount") ?? "Нет аккаунта?"}{" "}
              </span>
              <Link to="/register" className="text-primary hover:underline">
                {t("login.registerNow") ?? "Зарегистрируйтесь"}
              </Link>
            </div>
            <div className="text-center text-sm">
              <Link
                to="/legal/policies"
                className="text-muted-foreground hover:text-primary"
              >
                {t("login.policies") ?? "Политики и условия"}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
