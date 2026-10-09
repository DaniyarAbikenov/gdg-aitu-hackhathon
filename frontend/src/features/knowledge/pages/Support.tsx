import { tr, useLocale } from "@/i18n/copy";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
export default function Support() {
  useLocale();
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">{tr("copy.c489")}</h1>
        <section className="rounded-xl border p-6 space-y-3">
          <h2 className="text-xl font-semibold">{tr("copy.c490")}</h2>
          <p>{tr("copy.c491")}</p>
          <Button asChild>
            <Link to="/faq">{tr("copy.c492")}</Link>
          </Button>
        </section>
        <section className="rounded-xl border p-6 space-y-3">
          <h2 className="text-xl font-semibold">{tr("copy.c493")}</h2>
          <p>{tr("copy.c494")}</p>
          <p className="text-sm text-muted-foreground">{tr("copy.c495")}</p>
          <Button asChild variant="outline">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/DaniyarAbikenov/gdg-aitu-hackhathon/issues/new"
            >
              {tr("copy.c496")}
            </a>
          </Button>
        </section>
      </div>
    </MainLayout>
  );
}
