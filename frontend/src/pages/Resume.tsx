import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadResume } from "@/api/resume";
import { useResumeStore } from "@/store/resumeStore";

export default function Resume() {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const { toast } = useToast();
    const setResumeId = useResumeStore((s) => s.setResumeId);
    const navigate = useNavigate();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) {
                toast({
                    title: t("resume.upload.tooBig"),
                    description: t("resume.upload.tooBigDesc"),
                    variant: "destructive",
                });
                return;
            }
            setFile(selectedFile);
            toast({
                title: t("resume.fileSelected"),
                description: selectedFile.name,
            });
        }
    };

    async function handleUpload() {
        if (!file) return;

        try {
            const { resume_id } = await uploadResume(file);

            // сохраняем ID в Zustand
            setResumeId(resume_id);

            // переход на страницу редактирования
            navigate(`/resume/${resume_id}/edit`);
        } catch (err) {
            console.error(err);
            toast({
                title: t("resume.errorUpload"),
                description: t("resume.errorUploadDesc"),
                variant: "destructive",
            });
        }
    }

    return (
        <MainLayout>
            <div className="p-6 max-w-xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">{t("resume.title")}</h1>
                    <p className="text-muted-foreground">
                        {t("resume.uploadDescription")}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            {t("resume.upload.title")}
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                            <Input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="hidden"
                                id="resume-upload"
                            />
                            <Label
                                htmlFor="resume-upload"
                                className="cursor-pointer flex flex-col items-center gap-2"
                            >
                                <FileText className="h-12 w-12 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                  {file ? file.name : t("resume.clickToSelect")}
                </span>
                                <span className="text-xs text-muted-foreground">
                  {t("resume.onlyPdf")}
                </span>
                            </Label>
                        </div>

                        <Button
                            onClick={handleUpload}
                            disabled={!file}
                            className="w-full"
                        >
                            {t("resume.continue")}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
