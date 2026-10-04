import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Video } from "lucide-react";

export default function Plan() {
  const { t } = useTranslation();
  const [weekProgress, setWeekProgress] = useState<Record<number, boolean>>({});
  const { toast } = useToast();

  const toggleWeek = (week: number) => {
    setWeekProgress(prev => ({ ...prev, [week]: !prev[week] }));
  };

  const handleExport = () => {
    toast({
      title: t("plan.exported"),
      description: t("plan.exportedDesc"),
    });
  };

  const handleVideoOverview = () => {
    toast({
      title: t("plan.exported"),
      description: t("plan.exportedDesc"),
    });
  };

  const mockPlan = {
    weeks: [
      {
        week: 1,
        title: "HTML/CSS основы",
        goals: ["Изучить семантические теги HTML5", "Освоить Flexbox и Grid"],
        sources: [
          { title: "MDN HTML Guide", url: "https://developer.mozilla.org" },
          { title: "CSS Tricks - Flexbox", url: "https://css-tricks.com" },
        ],
      },
      {
        week: 2,
        title: "JavaScript основы",
        goals: ["Переменные, типы данных", "Циклы и условия", "Функции"],
        sources: [
          { title: "JavaScript.info", url: "https://javascript.info" },
          { title: "Eloquent JavaScript", url: "https://eloquentjavascript.net" },
        ],
      },
      {
        week: 3,
        title: "JavaScript продвинутый",
        goals: ["Async/await", "Promises", "Fetch API"],
        sources: [
          { title: "Async JavaScript Guide", url: "https://javascript.info/async" },
        ],
      },
      {
        week: 4,
        title: "React основы",
        goals: ["Компоненты и props", "State и lifecycle", "Events"],
        sources: [
          { title: "React Official Docs", url: "https://react.dev" },
        ],
      },
      {
        week: 5,
        title: "React Hooks",
        goals: ["useState, useEffect", "Custom hooks", "useContext"],
        sources: [
          { title: "React Hooks API", url: "https://react.dev/reference/react" },
        ],
      },
      {
        week: 6,
        title: "TypeScript",
        goals: ["Типы и интерфейсы", "Generics", "TypeScript с React"],
        sources: [
          { title: "TypeScript Handbook", url: "https://typescriptlang.org" },
        ],
      },
      {
        week: 7,
        title: "State Management",
        goals: ["Redux Toolkit", "Zustand basics", "Context patterns"],
        sources: [
          { title: "Redux Toolkit Docs", url: "https://redux-toolkit.js.org" },
        ],
      },
      {
        week: 8,
        title: "Testing",
        goals: ["Jest basics", "React Testing Library", "Integration tests"],
        sources: [
          { title: "Testing Library", url: "https://testing-library.com" },
        ],
      },
    ],
    explanation: "План подобран под роль Frontend Developer с учетом текущих навыков. Акцент на React и TypeScript, так как это ключевые требования большинства вакансий. Последние недели посвящены state management и тестированию — это поможет выделиться среди junior-разработчиков.",
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t("plan.title")}</h1>
            <p className="text-muted-foreground">
              Персональный 8-недельный план развития
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {Object.values(weekProgress).filter(Boolean).length} / {mockPlan.weeks.length} недель
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("plan.explanation")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {mockPlan.explanation}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {mockPlan.weeks.map(week => (
            <Card key={week.week}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {t("plan.week")} {week.week}: {week.title}
                  </CardTitle>
                  <Checkbox
                    checked={weekProgress[week.week] || false}
                    onCheckedChange={() => toggleWeek(week.week)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2">{t("plan.goals")}:</h4>
                  <ul className="space-y-1">
                    {week.goals.map((goal, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {goal}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">{t("plan.sources")}:</h4>
                  <div className="flex flex-wrap gap-2">
                    {week.sources.map((source, i) => (
                      <a
                        key={i}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {source.title}
                      </a>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            {t("plan.export")}
          </Button>
          <Button onClick={handleVideoOverview} variant="outline" className="flex-1">
            <Video className="h-4 w-4 mr-2" />
            {t("plan.notebookLM")}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
