import type { ResumeRecord } from "@/api/resume";
import type { ProgressRecord } from "@/types/career";
import type { Profile } from "@/types/career";
import type { PlanRecord } from "@/types/career";
import { useEffect, useState } from "react";
import client from "@/api/client";
import { getUserProfile } from "@/api/user";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, FileText, Briefcase, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<ProgressRecord | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([
      getUserProfile(),
      client.get("/progress"),
      client.get("/plan"),
      client.get("/resume"),
    ])
      .then(([profile, progress, plans, resumes]) => {
        setProfile(profile);
        setProgress(progress.data);
        setPlans(plans.data);
        setResumes(resumes.data);
      })
      .catch((e) => setError(e.message));
  }, []);
  const handleCreatePlan = async () => {
    if (!profile?.career_goal) {
      navigate("/onboarding");
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.post("/plan", {
        goal: profile.career_goal,
        resume_id: resumes[0]?.resume_id,
      });
      navigate(`/plan/${data.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const targetRoles =
    profile?.career_goal
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const skillGaps = [
    ...new Set<string>(
      resumes.flatMap((r) => r.analysis?.missing_skills || []),
    ),
  ];

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {t("dashboard.compass.title")}
              </CardTitle>
              <CardDescription>
                {t("dashboard.compass.targetRoles")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t("dashboard.compass.targetRoles")}:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {targetRoles.length === 0 && (
                    <Button
                      variant="link"
                      onClick={() => navigate("/onboarding")}
                    >
                      Заполнить профиль
                    </Button>
                  )}
                  {targetRoles.map((role) => (
                    <Badge key={role} variant="default">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t("dashboard.compass.skillGaps")}:
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {skillGaps.map((gap, i) => (
                    <li key={i}>• {gap}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                {t("dashboard.plan.title")}
              </CardTitle>
              <CardDescription>Ваш путь к цели</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {plans[0]?.data.goal || t("dashboard.plan.noPlan")}
              </p>

              <div className="space-y-2">
                <Button
                  onClick={handleCreatePlan}
                  disabled={busy}
                  className="w-full"
                >
                  {t("dashboard.plan.create")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    navigate(plans[0] ? `/plan/${plans[0].id}` : "/plan")
                  }
                >
                  {t("dashboard.plan.open")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t("dashboard.resume.title")}
              </CardTitle>
              <CardDescription>
                {t("dashboard.resume.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Загрузите резюме, проанализируйте и адаптируйте под конкретные
                вакансии.
              </p>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/resume")}
              >
                {t("dashboard.resume.goto")}
              </Button>

              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Версий:</span>
                  <span className="font-medium">
                    {progress?.resume_versions ?? "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Быстрая статистика
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {t("progress.planSteps")}
                </p>
                <p className="text-2xl font-bold">
                  {progress
                    ? `${progress.completed_modules} / ${progress.total_modules}`
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {t("progress.interviewScore")}
                </p>
                <p className="text-2xl font-bold">
                  {progress?.average_score ?? "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Версий резюме</p>
                <p className="text-2xl font-bold">
                  {progress?.resume_versions ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
