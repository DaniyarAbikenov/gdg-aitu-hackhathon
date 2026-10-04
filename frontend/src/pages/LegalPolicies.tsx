import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegalPolicies() {
  const { t } = useTranslation();
  const lastUpdated = "15 января 2025";

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("legal.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("legal.updated")}: {lastUpdated}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Общие положения</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Настоящая Политика конфиденциальности определяет порядок обработки и защиты
              персональных данных пользователей сервиса {t("app.name")} (далее — Сервис).
            </p>
            <p>
              Используя Сервис, вы соглашаетесь с условиями настоящей Политики. Если вы
              не согласны с какими-либо положениями, пожалуйста, не используйте Сервис.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Собираемые данные</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-4">
            <div>
              <h4 className="font-medium mb-2">Мы собираем следующие категории данных:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Регистрационные данные (имя, email, пароль)</li>
                <li>Профессиональная информация (навыки, опыт, целевые роли)</li>
                <li>Загруженные резюме и связанные документы</li>
                <li>Ответы на вопросы тренировок интервью</li>
                <li>Данные о прогрессе обучения</li>
                <li>Технические данные (IP-адрес, тип устройства, браузер)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Использование данных</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-4">
            <div>
              <h4 className="font-medium mb-2">Мы используем собранные данные для:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Предоставления и улучшения функционала Сервиса</li>
                <li>Персонализации планов обучения и рекомендаций</li>
                <li>Анализа резюме и предоставления фидбека</li>
                <li>Генерации отчетов о прогрессе</li>
                <li>Отправки важных уведомлений о Сервисе</li>
                <li>Обеспечения безопасности и предотвращения мошенничества</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Защита данных</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Мы применяем современные технические и организационные меры для защиты
              ваших персональных данных от несанкционированного доступа, изменения,
              раскрытия или уничтожения.
            </p>
            <p>
              Все данные передаются по защищенному протоколу HTTPS. Пароли хранятся
              в зашифрованном виде. Доступ к персональным данным имеют только
              уполномоченные сотрудники.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Передача данных третьим лицам</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Мы не продаем и не передаем ваши персональные данные третьим лицам
              в коммерческих целях. Данные могут быть переданы только:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>С вашего явного согласия</li>
              <li>Поставщикам услуг, работающим от нашего имени (с соблюдением NDA)</li>
              <li>По требованию законодательства или государственных органов</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Ваши права</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>Вы имеете право:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Получать информацию о хранящихся данных</li>
              <li>Исправлять неточные данные</li>
              <li>Удалить свой аккаунт и все связанные данные</li>
              <li>Экспортировать свои данные</li>
              <li>Отозвать согласие на обработку данных</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Cookies и аналитика</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Мы используем cookies для улучшения работы Сервиса и аналитики.
              Вы можете настроить использование cookies в браузере, однако это
              может ограничить функционал Сервиса.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Изменения в Политике</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              Мы можем обновлять настоящую Политику. О существенных изменениях
              мы уведомим вас по email или через уведомление в Сервисе.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>9. Контакты</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p>
              По вопросам защиты персональных данных обращайтесь:
            </p>
            <p className="text-muted-foreground">
              Email: privacy@a2d.example.com<br />
              Адрес: г. Москва, ул. Примерная, д. 1
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>Дата последнего обновления: {lastUpdated}</p>
        </div>
      </div>
    </MainLayout>
  );
}
