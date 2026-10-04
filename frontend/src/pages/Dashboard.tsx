import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, FileText, Briefcase, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreatePlan = () => {
    toast({
      title: "Создание плана...",
      description: "Генерируем персональный план обучения",
    });
    setTimeout(() => navigate("/plan/p_demo"), 1000);
  };

  const targetRoles = ["Frontend Developer", "Full Stack Developer", "React Developer"];
  const skillGaps = [
    "React Hooks продвинутые паттерны",
    "TypeScript generics",
    "State management (Redux/Zustand)",
    "Testing (Jest, React Testing Library)",
    "CI/CD и DevOps основы",
  ];

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {t("dashboard.compass.title")}
              </CardTitle>
              <CardDescription>{t("dashboard.compass.targetRoles")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">{t("dashboard.compass.targetRoles")}:</h4>
                <div className="flex flex-wrap gap-2">
                  {targetRoles.map(role => (
                    <Badge key={role} variant="default">{role}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">{t("dashboard.compass.skillGaps")}:</h4>
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
                {t("dashboard.plan.noPlan")}
              </p>
              
              <div className="space-y-2">
                <Button onClick={handleCreatePlan} className="w-full">
                  {t("dashboard.plan.create")}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate("/plan/p_demo")}
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
              <CardDescription>{t("dashboard.resume.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Загрузите резюме, проанализируйте и адаптируйте под конкретные вакансии.
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
                  <span className="font-medium">3</span>
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
                <p className="text-sm text-muted-foreground">{t("progress.planSteps")}</p>
                <p className="text-2xl font-bold">3 из 10</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("progress.interviewScore")}</p>
                <p className="text-2xl font-bold">74</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Версий резюме</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
