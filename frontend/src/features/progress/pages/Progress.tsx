import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { Journey } from "../components/Journey";
import { useClaimReward, useProgress } from "../api";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, MessageSquare, FileText, Award } from "lucide-react";

export default function Progress() {
  useLocale();
  const { t } = useTranslation();

  const { data: progress, error: loadError } = useProgress();
  const claim = useClaimReward();
  const failure = loadError ?? claim.error;
  const error = failure ? getErrorMessage(failure) : "";
  const handleClaimReward = (id: string) => claim.mutate(id);
  const stats = {
    planSteps: {
      completed: progress?.completed_modules ?? 0,
      total: progress?.total_modules ?? 0,
    },
    avgInterviewScore: progress?.average_score,
    resumeIndex: progress?.resume_versions ?? 0,
  };
  const rewards = (progress?.rewards || []).map((r) => ({
    ...r,
    id: r.key,
    name: tr("ui." + r.key),
    description: "",
    icon:
      {
        "first-step": Target,
        interview: MessageSquare,
        resume: FileText,
        persistence: Trophy,
      }[r.key] || Trophy,
  }));

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Journey />
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("progress.title")}</h1>
          <p className="text-muted-foreground">{t("progress.subtitle")}</p>
          <Link
            className="mt-2 inline-block text-primary underline"
            to="/applications/funnel"
          >
            {tr("funnel.title")}
          </Link>
        </div>

        {error && <p role="alert">{error}</p>}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                {tr("copy.c403")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">
                  {stats.planSteps.completed} / {stats.planSteps.total}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("progress.planSteps")}
                </p>
                <div className="w-full bg-muted rounded-full h-2 mt-4">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${(stats.planSteps.completed / (stats.planSteps.total || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
                {tr("copy.c322")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">
                  {stats.avgInterviewScore ?? "—"}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("progress.interviewScore")}
                </p>
                <Badge
                  variant={
                    (stats.avgInterviewScore ?? 0) >= 70
                      ? "default"
                      : "secondary"
                  }
                  className="mt-4"
                >
                  {stats.avgInterviewScore == null
                    ? tr("copy.c404")
                    : tr("copy.c405")}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                {tr("copy.c242")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{stats.resumeIndex}</div>
                <p className="text-sm text-muted-foreground">
                  {tr("copy.c406")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              {t("progress.rewards.title")}
            </CardTitle>
            <CardDescription>{tr("copy.c407")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {rewards.map((reward) => {
                const Icon = reward.icon;
                return (
                  <div
                    key={reward.id}
                    className={`p-4 border rounded-lg ${
                      reward.available && !reward.claimed
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-medium">{reward.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {reward.description}
                        </p>
                        {reward.available && !reward.claimed && (
                          <Button
                            size="sm"
                            onClick={() => handleClaimReward(reward.id)}
                            className="mt-2"
                          >
                            {t("progress.rewards.claim")}
                          </Button>
                        )}
                        {!reward.available && (
                          <Badge variant="outline" className="mt-2">
                            {tr("copy.c408")}
                          </Badge>
                        )}
                        {reward.claimed && (
                          <Badge variant="default" className="mt-2">
                            {tr("copy.c409")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr("copy.c410")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{tr("copy.c411")}</p>
            <p>{tr("copy.c412")}</p>
            <p>{tr("copy.c413")}</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
