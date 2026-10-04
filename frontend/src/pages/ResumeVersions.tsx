import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Eye, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function ResumeVersions() {
  const { t } = useTranslation();
  const [activeVersion, setActiveVersion] = useState("v1");
  const { toast } = useToast();

  const handleDownload = (versionId: string) => {
    toast({
      title: t("resume.versions.downloadStarted"),
      description: `${t("resume.versions.version")} ${versionId}`,
    });
  };

  const handleSetActive = (versionId: string) => {
    setActiveVersion(versionId);
    toast({
      title: t("resume.versions.versionActivated"),
      description: `${t("resume.versions.version")} ${versionId} ${t("resume.versions.versionNowActive")}`,
    });
  };

  const versions = [
    {
      id: "v1",
      date: "15.01.2025",
      tag: "Оригинал",
      description: "Первоначальная версия",
    },
    {
      id: "v2",
      date: "16.01.2025",
      tag: "Под Frontend вакансию",
      description: "Адаптировано под React позицию",
    },
    {
      id: "v3",
      date: "17.01.2025",
      tag: "Под Full Stack вакансию",
      description: "Добавлен опыт с бэкендом",
    },
  ];

  const mockDiff = {
    before: "Frontend Developer с опытом в React.\n\nОпыт работы:\n- Разработка компонентов\n- Работа с API",
    after: "Frontend Developer с 3+ годами опыта в React и TypeScript.\n\nОпыт работы:\n- Разработка более 50 переиспользуемых React компонентов\n- Интеграция 15+ REST API endpoints\n- Написание 200+ unit тестов с Jest и React Testing Library",
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("resume.versions.title")}</h1>
          <p className="text-muted-foreground">
            {t("resume.versions.description")}
          </p>
        </div>

        <div className="space-y-4">
          {versions.map((version) => (
            <Card key={version.id} className={version.id === activeVersion ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{t("resume.versions.version")} {version.id}</CardTitle>
                      {version.id === activeVersion && (
                        <Badge variant="default">{t("resume.versions.active")}</Badge>
                      )}
                      <Badge variant="outline">{version.tag}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {version.date} • {version.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        {t("resume.versions.showDiff")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{t("resume.versions.differences")}: {version.tag}</DialogTitle>
                      </DialogHeader>
                      <Tabs defaultValue="after">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="before">{t("resume.improve.before")}</TabsTrigger>
                          <TabsTrigger value="after">{t("resume.improve.after")}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="before">
                          <Textarea
                            value={mockDiff.before}
                            readOnly
                            rows={12}
                          />
                        </TabsContent>
                        <TabsContent value="after">
                          <Textarea
                            value={mockDiff.after}
                            readOnly
                            rows={12}
                            className="border-primary"
                          />
                        </TabsContent>
                      </Tabs>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(version.id)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t("resume.versions.download")}
                  </Button>

                  {version.id !== activeVersion && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSetActive(version.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t("resume.versions.makeActive")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("resume.versions.tips")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• {t("resume.versions.tip1")}</p>
            <p>• {t("resume.versions.tip2")}</p>
            <p>• {t("resume.versions.tip3")}</p>
            <p>• {t("resume.versions.tip4")}</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
