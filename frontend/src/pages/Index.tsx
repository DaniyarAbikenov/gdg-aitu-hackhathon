import { tr, useLocale } from "@/i18n/copy";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  FileCheck2,
  MessageSquare,
  Route,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
export default function Index() {
  useLocale();
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();
  if (isAuthenticated && location.pathname === "/")
    return <Navigate to="/dashboard" replace />;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">
          A2D{" "}
          <span className="text-sm font-normal text-muted-foreground">
            Career Studio
          </span>
        </Link>
        <nav className="flex gap-2 sm:gap-4 items-center">
          <LanguageSwitcher />
          <Link to="/faq" className="text-sm hidden sm:block">
            {tr("copy.c294")}
          </Link>
          <Button asChild variant="outline">
            <Link to={isAuthenticated ? "/dashboard" : "/login"}>
              {isAuthenticated ? tr("copy.c295") : tr("copy.c296")}
            </Link>
          </Button>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-6">
        <section className="landing-hero py-14 sm:py-24 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
          <div className="space-y-6">
            <p className="text-sm font-semibold tracking-wide text-primary">
              {tr("copy.c297")}
            </p>
            <h1 className="landing-title">{tr("copy.c298")}</h1>
            <p className="text-lg text-muted-foreground">{tr("copy.c299")}</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild disabled={isLoading}>
                <Link to={isAuthenticated ? "/applications" : "/register"}>
                  {tr("copy.c300")}
                  <ArrowRight size={17} className="ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#workflow">{tr("copy.c301")}</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{tr("copy.c302")}</p>
          </div>
          <div className="route-notebook p-6 sm:p-8 space-y-5">
            <p className="text-xs uppercase tracking-wider text-primary">
              {tr("copy.c303")}
            </p>
            <h2 className="text-2xl font-semibold">Junior Backend Developer</h2>
            {[
              tr("copy.c304"),
              tr("copy.c305"),
              tr("copy.c306"),
              tr("copy.c307"),
            ].map((s, i) => (
              <div key={s} className="flex gap-3 items-start">
                <span className="rounded-full bg-white/10 w-8 h-8 shrink-0 grid place-items-center">
                  {i + 1}
                </span>
                <p className="pt-1">{s}</p>
              </div>
            ))}
            <p className="border-t border-foreground/20 pt-4 text-sm text-muted-foreground">
              {tr("copy.c308")}
            </p>
          </div>
        </section>
        <section id="workflow" className="py-12 border-t space-y-7">
          <h2 className="text-3xl font-bold">{tr("copy.c309")}</h2>
          <div className="workflow-editorial grid md:grid-cols-3 gap-8">
            {[
              {
                icon: FileCheck2,
                title: tr("copy.c310"),
                text: tr("copy.c311"),
              },
              {
                icon: MessageSquare,
                title: tr("copy.c312"),
                text: tr("copy.c313"),
              },
              {
                icon: Route,
                title: tr("copy.c314"),
                text: tr("copy.c315"),
              },
            ].map((x) => (
              <article
                key={x.title}
                className="border rounded-xl p-6 space-y-3"
              >
                <x.icon className="text-primary" />
                <h3 className="text-xl font-semibold">{x.title}</h3>
                <p className="text-muted-foreground">{x.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="py-12 border-t grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <ShieldCheck className="text-primary" />
            <h2 className="text-2xl font-bold">{tr("copy.c316")}</h2>
            <p className="text-muted-foreground">{tr("copy.c317")}</p>
            <Link className="text-primary underline" to="/legal/policies">
              {tr("copy.c318")}
            </Link>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">{tr("copy.c319")}</h2>
            <p className="text-muted-foreground">{tr("copy.c320")}</p>
            <a
              className="text-primary underline"
              href="https://github.com/DaniyarAbikenov/gdg-aitu-hackhathon"
              target="_blank"
              rel="noopener noreferrer"
            >
              {tr("copy.c321")}
            </a>
          </div>
        </section>
      </main>
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t text-sm text-muted-foreground flex flex-wrap gap-5">
        <span>A2D Career Studio</span>
        <Link to="/faq">{tr("copy.c126")}</Link>
        <Link to="/support">{tr("copy.c030")}</Link>
      </footer>
    </div>
  );
}
