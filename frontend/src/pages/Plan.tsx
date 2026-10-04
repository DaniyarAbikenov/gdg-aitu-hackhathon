import type { PlanRecord } from "@/types/career";
import { useParams, Link } from "react-router-dom";
import client from "@/api/client";
import { useState, useEffect } from "react";
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
  const { planId } = useParams();
  const [record, setRecord] = useState<PlanRecord | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    client
      .get("/plan")
      .then(({ data }) => {
        setPlans(data);
        setRecord(data.find((p) => p.id === planId) || null);
      })
      .catch((e) => setError(e.message));
  }, [planId]);
  const toggleWeek = async (week: number) => {
    setBusy(true);
    try {
      const { data } = await client.post(`/plan/${record.id}/modules/${week}`, {
        revision: record.revision,
        completed: !weekProgress[week],
        evidence: record.data.modules.find((m) => m.id === String(week))
          .evidence,
      });
      setRecord(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const handleExport = () => {
    window.location.assign(`/api/plan/${record.id}/export`);
  };
  const handleVideoOverview = () => {
    handleExport();
    window.open(
      "https://notebooklm.google.com/",
      "_blank",
      "noopener,noreferrer",
    );
  };
  const weekProgress = Object.fromEntries(
    (record?.data.modules || []).map((m) => [m.id, m.completed]),
  );
  const plan = {
    explanation: record?.data.explanation || "",
    weeks: (record?.data.modules || []).map((m) => ({
      ...m,
      week: Number(m.id),
      sources: [
        {
          title: m.resource_topic,
          url: `https://www.google.com/search?q=${encodeURIComponent(m.resource_topic)}`,
        },
      ],
    })),
  };
  if (!record)
    return (
      <MainLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">{t("plan.title")}</h1>
          {error && <p role="alert">{error}</p>}
          {plans.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-6">
                <Link to={`/plan/${p.id}`}>{p.data.goal}</Link>
              </CardContent>
            </Card>
          ))}
          {!plans.length && (
            <p>
              Пока нет планов. Создайте план на главной странице после
              заполнения профиля.
            </p>
          )}
          <Link to="/dashboard">На главную</Link>
        </div>
      </MainLayout>
    );

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t("plan.title")}</h1>
            <p className="text-muted-foreground">
              Персональный 8-недельный план развития
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {Object.values(weekProgress).filter(Boolean).length} /{" "}
            {plan.weeks.length} недель
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("plan.explanation")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {plan.explanation}
            </p>
          </CardContent>
        </Card>

        {error && <p role="alert">{error}</p>}
        <div className="space-y-4">
          {plan.weeks.map((week) => (
            <Card key={week.week}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="min-w-0 flex-1 break-words text-lg">
                    {t("plan.week")} {week.week}: {week.title}
                  </CardTitle>
                  <Checkbox
                    disabled={busy}
                    aria-label={`Неделя ${week.week} завершена`}
                    checked={weekProgress[week.week] || false}
                    onCheckedChange={() => toggleWeek(week.week)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {t("plan.goals")}:
                  </h4>
                  <ul className="space-y-1">
                    {week.goals.map((goal, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {goal}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm">
                  {week.exercise} · {week.hours} ч.
                </p>
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {t("plan.sources")}:
                  </h4>
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

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} variant="outline" className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            {t("plan.export")}
          </Button>
          <Button
            onClick={handleVideoOverview}
            variant="outline"
            className="flex-1"
          >
            <Video className="h-4 w-4 mr-2" />
            {t("plan.notebookLM")}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
