import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FAQ() {
  const { t } = useTranslation();

  const faqItems = [
    { id: "1", question: t("faq.items.1.question"), answer: t("faq.items.1.answer") },
    { id: "2", question: t("faq.items.2.question"), answer: t("faq.items.2.answer") },
    { id: "3", question: t("faq.items.3.question"), answer: t("faq.items.3.answer") },
    { id: "4", question: t("faq.items.4.question"), answer: t("faq.items.4.answer") },
    { id: "5", question: t("faq.items.5.question"), answer: t("faq.items.5.answer") },
    { id: "6", question: t("faq.items.6.question"), answer: t("faq.items.6.answer") },
    { id: "7", question: t("faq.items.7.question"), answer: t("faq.items.7.answer") },
    { id: "8", question: t("faq.items.8.question"), answer: t("faq.items.8.answer") },
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("faq.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("faq.description")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("faq.general")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
