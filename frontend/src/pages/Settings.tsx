import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Mic } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Settings() {
  const { t } = useTranslation();
  const [audioMode, setAudioMode] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = () => {
    toast({
      title: t("settings.logout.success"),
      description: t("settings.logout.successDesc"),
    });
    setTimeout(() => navigate("/login"), 500);
  };

  const handleAudioToggle = (checked: boolean) => {
    setAudioMode(checked);
    toast({
      title: checked ? t("settings.interview.enabled") : t("settings.interview.disabled"),
      description: checked
        ? t("settings.interview.enabledDesc")
        : t("settings.interview.disabledDesc"),
    });
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("settings.title")}</h1>
          <p className="text-muted-foreground">
            {t("settings.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.language.title")}</CardTitle>
            <CardDescription>
              {t("settings.language.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              {t("settings.interview.title")}
            </CardTitle>
            <CardDescription>
              {t("settings.interview.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="audio-mode" className="text-base">
                  {t("settings.interview.audioMode")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.interview.audioDesc")}
                </p>
              </div>
              <Switch
                id="audio-mode"
                checked={audioMode}
                onCheckedChange={handleAudioToggle}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.profile.title")}</CardTitle>
            <CardDescription>{t("settings.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t("settings.profile.email")}</Label>
              <p className="text-sm text-muted-foreground">user@example.com</p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t("settings.profile.targetRoles")}</Label>
              <p className="text-sm text-muted-foreground">
                Frontend Developer, Full Stack Developer
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/onboarding")}>
              {t("settings.profile.editProfile")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.notifications.title")}</CardTitle>
            <CardDescription>
              {t("settings.notifications.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("settings.notifications.inDevelopment")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{t("settings.logout.title")}</CardTitle>
            <CardDescription>
              {t("settings.logout.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              {t("settings.logout.button")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
