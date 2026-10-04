import type { VersionRecord } from "@/types/career";
import type { ResumeRecord } from "@/api/resume";
import { useParams, Link } from "react-router-dom";
import client from "@/api/client";
import { getResume, saveVersion } from "@/api/resume";
import { useState, useEffect } from "react";
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
  const { resumeId } = useParams();
  const [activeVersion, setActiveVersion] = useState("");
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [error, setError] = useState("");
  const load = async () => {
    const [r, v] = await Promise.all([
      getResume(resumeId!),
      client.get(`/resume/${resumeId}/versions`),
    ]);
    setResume(r);
    setVersions(
      v.data.map((v) => ({
        ...v,
        tag: v.data.label,
        date: new Date(v.created_at).toLocaleDateString(),
        description: v.data.jd_text,
      })),
    );
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [resumeId]);
  const handleDownload = (id: string) =>
    window.location.assign(`/api/versions/${id}/pdf`);
  const handleSetActive = async (id: string) => {
    try {
      await client.post(`/versions/${id}/restore`, {
        revision: resume.revision,
      });
      await load();
      setActiveVersion(id);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {t("resume.versions.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("resume.versions.description")}
          </p>
        </div>

        {error && <p role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!resume}
            onClick={async () => {
              try {
                await saveVersion(
                  resumeId!,
                  resume.fields,
                  resume.revision,
                  `Версия ${versions.length + 1}`,
                  resume.jd_text,
                );
                await load();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Сохранить текущую версию
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/resume/${resumeId}/edit`}>Редактировать</Link>
          </Button>
        </div>
        {!versions.length && <p>Пока нет сохранённых версий.</p>}
        <div className="space-y-4">
          {versions.map((version) => (
            <Card
              key={version.id}
              className={version.id === activeVersion ? "border-primary" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {t("resume.versions.version")} {version.id}
                      </CardTitle>
                      {version.id === activeVersion && (
                        <Badge variant="default">
                          {t("resume.versions.active")}
                        </Badge>
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
                        <DialogTitle>
                          {t("resume.versions.differences")}: {version.tag}
                        </DialogTitle>
                      </DialogHeader>
                      <Tabs defaultValue="after">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="before">
                            {t("resume.improve.before")}
                          </TabsTrigger>
                          <TabsTrigger value="after">
                            {t("resume.improve.after")}
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="before">
                          <Textarea
                            value={JSON.stringify(version.data.before, null, 2)}
                            readOnly
                            rows={12}
                          />
                        </TabsContent>
                        <TabsContent value="after">
                          <Textarea
                            value={JSON.stringify(version.data.fields, null, 2)}
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
