import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  FileCheck2,
  MessageSquare,
  Route,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
export default function Index() {
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
        <nav className="flex gap-4 items-center">
          <Link to="/faq" className="text-sm hidden sm:block">
            Как это работает
          </Link>
          <Button asChild variant="outline">
            <Link to={isAuthenticated ? "/dashboard" : "/login"}>
              {isAuthenticated ? "В кабинет" : "Войти"}
            </Link>
          </Button>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-6">
        <section className="py-14 sm:py-24 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
          <div className="space-y-6">
            <p className="text-sm font-semibold tracking-wide text-primary">
              ПОДГОТОВКА К ПЕРВОЙ РАБОТЕ В IT
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
              От выбранной вакансии — к уверенной подготовке.
            </h1>
            <p className="text-lg text-muted-foreground">
              Соберите резюме из реального опыта, потренируйте ответы и
              превратите обратную связь в учебный план. Всё — в контексте
              конкретной позиции.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild disabled={isLoading}>
                <Link to={isAuthenticated ? "/applications" : "/register"}>
                  Начать подготовку
                  <ArrowRight size={17} className="ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#workflow">Посмотреть сценарий</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Профиль, ручное резюме, PDF / Word и учёт откликов доступны без
              ИИ.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-950 text-white p-6 sm:p-8 space-y-5">
            <p className="text-xs uppercase tracking-wider text-blue-300">
              Пример маршрута · не данные пользователя
            </p>
            <h2 className="text-2xl font-semibold">Junior Backend Developer</h2>
            {[
              "Подтвердить опыт учебного проекта",
              "Подготовить резюме под требования",
              "Объяснить решение на тренировке",
              "Закрыть пробелы практическими заданиями",
            ].map((s, i) => (
              <div key={s} className="flex gap-3 items-start">
                <span className="rounded-full bg-white/10 w-8 h-8 shrink-0 grid place-items-center">
                  {i + 1}
                </span>
                <p className="pt-1">{s}</p>
              </div>
            ))}
            <p className="border-t border-white/20 pt-4 text-sm text-slate-300">
              Уровни и баллы отражают подготовку. Решение о найме принимает
              работодатель.
            </p>
          </div>
        </section>
        <section id="workflow" className="py-12 border-t space-y-7">
          <h2 className="text-3xl font-bold">
            Каждый шаг оставляет полезный результат
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: FileCheck2,
                title: "Резюме, которое можно проверить",
                text: "Опыт, проекты и навыки из профиля. Изменения ИИ принимаются вами; версии до и после сохраняются.",
              },
              {
                icon: MessageSquare,
                title: "Практика перед настоящим разговором",
                text: "Текстовое или голосовое интервью. История ответов и обратная связь помогают увидеть, что объяснить лучше.",
              },
              {
                icon: Route,
                title: "Следующее действие вместо бесконечных советов",
                text: "План с упражнениями, заметки по вакансии и дата следующего контакта. Прогресс остаётся между сессиями.",
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
            <h2 className="text-2xl font-bold">Вы контролируете свои данные</h2>
            <p className="text-muted-foreground">
              Отклики не отправляются автоматически. ИИ получает материалы
              только при запуске соответствующего действия. Данные аккаунта
              можно экспортировать.
            </p>
            <Link className="text-primary underline" to="/legal/policies">
              Как хранятся и обрабатываются данные
            </Link>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">Об этом проекте</h2>
            <p className="text-muted-foreground">
              Career Studio вырос из хакатонного CareerBot. Это портфолио-проект
              полного цикла: React, FastAPI, PostgreSQL, Redis, Docker и CI.
              ИИ-функции требуют настройки провайдера на сервере.
            </p>
            <a
              className="text-primary underline"
              href="https://github.com/DaniyarAbikenov/gdg-aitu-hackhathon"
              target="_blank"
              rel="noopener noreferrer"
            >
              Код и архитектура на GitHub ↗
            </a>
          </div>
        </section>
      </main>
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t text-sm text-muted-foreground flex flex-wrap gap-5">
        <span>A2D Career Studio</span>
        <Link to="/faq">База знаний</Link>
        <Link to="/support">Обратная связь</Link>
      </footer>
    </div>
  );
}
