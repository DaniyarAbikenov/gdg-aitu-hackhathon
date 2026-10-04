import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Target, MessageSquare, FileText, Award } from "lucide-react";

export default function Progress() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleClaimReward = (rewardId: string) => {
    toast({
      title: "Награда получена!",
      description: "Поздравляем с достижением",
    });
  };

  const stats = {
    planSteps: { completed: 3, total: 10 },
    avgInterviewScore: 74,
    resumeIndex: 85,
  };

  const rewards = [
    { id: "r1", name: "Первый шаг", description: "Завершите первую неделю плана", available: true, claimed: false, icon: Target },
    { id: "r2", name: "Собеседование пройдено", description: "Наберите 70+ баллов", available: true, claimed: false, icon: MessageSquare },
    { id: "r3", name: "Мастер резюме", description: "Создайте 3 версии резюме", available: true, claimed: false, icon: FileText },
    { id: "r4", name: "Упорство", description: "Завершите 5 недель плана", available: false, claimed: false, icon: Trophy },
  ];

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("progress.title")}</h1>
          <p className="text-muted-foreground">
            {t("progress.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                План обучения
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
                      width: `${(stats.planSteps.completed / stats.planSteps.total) * 100}%`,
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
                Интервью
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{stats.avgInterviewScore}</div>
                <p className="text-sm text-muted-foreground">
                  {t("progress.interviewScore")}
                </p>
                <Badge variant={stats.avgInterviewScore >= 70 ? "default" : "secondary"} className="mt-4">
                  {stats.avgInterviewScore >= 70 ? "Отлично" : "Хорошо"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Резюме
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{stats.resumeIndex}</div>
                <p className="text-sm text-muted-foreground">
                  {t("progress.resumeIndex")}
                </p>
                <div className="flex gap-1 mt-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={star <= Math.floor(stats.resumeIndex / 20) ? "text-warning" : "text-muted"}
                    >
                      ★
                    </span>
                  ))}
                </div>
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
            <CardDescription>
              Получайте бейджи за выполнение целей
            </CardDescription>
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
                            Заблокировано
                          </Badge>
                        )}
                        {reward.claimed && (
                          <Badge variant="default" className="mt-2">
                            Получено
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
            <CardTitle>Рекомендации</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Завершите еще 2 недели плана, чтобы получить награду "Упорство"</p>
            <p>• Пройдите еще одну тренировку интервью для улучшения среднего балла</p>
            <p>• Создайте версию резюме под новую вакансию</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
