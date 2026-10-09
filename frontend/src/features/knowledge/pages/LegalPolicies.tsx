import { tr, useLocale } from "@/i18n/copy";
import { MainLayout } from "@/components/layout/MainLayout";
export default function LegalPolicies() {
  useLocale();
  return (
    <MainLayout>
      <article className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">{tr("copy.c363")}</h1>
        <p className="text-sm text-muted-foreground">{tr("copy.c364")}</p>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{tr("copy.c365")}</h2>
          <p>{tr("copy.c366")}</p>
          <p>{tr("copy.c367")}</p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{tr("copy.c368")}</h2>
          <p>{tr("copy.c369")}</p>
          <p>{tr("copy.c370")}</p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{tr("copy.c343")}</h2>
          <p>{tr("copy.c371")}</p>
          <p>{tr("copy.c372")}</p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{tr("copy.c373")}</h2>
          <p>{tr("copy.c374")}</p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{tr("copy.c375")}</h2>
          <p>{tr("copy.c376")}</p>
        </section>
      </article>
    </MainLayout>
  );
}
