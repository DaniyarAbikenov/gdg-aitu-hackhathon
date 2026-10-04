import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Phone } from "lucide-react";

export default function Support() {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("support.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("support.description")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Mail className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("support.email.title")}</CardTitle>
              <CardDescription>{t("support.email.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                {t("support.email.action")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MessageCircle className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("support.chat.title")}</CardTitle>
              <CardDescription>{t("support.chat.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                {t("support.chat.action")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Phone className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("support.phone.title")}</CardTitle>
              <CardDescription>{t("support.phone.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                {t("support.phone.action")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("support.form.title")}</CardTitle>
            <CardDescription>{t("support.form.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("support.form.name")}</label>
              <input className="w-full mt-1 px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("support.form.email")}</label>
              <input type="email" className="w-full mt-1 px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("support.form.message")}</label>
              <textarea className="w-full mt-1 px-3 py-2 border rounded-md" rows={5} />
            </div>
            <Button className="w-full">{t("support.form.submit")}</Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
