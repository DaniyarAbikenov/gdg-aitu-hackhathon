import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
export default function Support() {
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Помощь и обратная связь</h1>
        <section className="rounded-xl border p-6 space-y-3">
          <h2 className="text-xl font-semibold">Найти инструкцию</h2>
          <p>
            Сборка резюме, подготовка к интервью, учебные планы и работа с
            профилем описаны в базе знаний.
          </p>
          <Button asChild>
            <Link to="/faq">Открыть базу знаний</Link>
          </Button>
        </section>
        <section className="rounded-xl border p-6 space-y-3">
          <h2 className="text-xl font-semibold">
            Сообщить об ошибке или предложить улучшение
          </h2>
          <p>
            Опишите, что вы делали, какой результат ожидали и что произошло.
            Приложите скриншот без личных данных.
          </p>
          <p className="text-sm text-muted-foreground">
            Обращение откроется в GitHub. Не публикуйте пароли, API-ключи,
            резюме и контактные данные.
          </p>
          <Button asChild variant="outline">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/DaniyarAbikenov/gdg-aitu-hackhathon/issues/new"
            >
              Создать обращение в GitHub
            </a>
          </Button>
        </section>
      </div>
    </MainLayout>
  );
}
