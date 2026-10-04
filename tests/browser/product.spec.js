const { test, expect } = require("@playwright/test");
const { register, password } = require("./helpers");

test("profile blocks, resume creation, archive and dashboard preferences persist", async ({
  page,
}) => {
  await register(page);
  await page.locator("#name").fill("Profile Candidate");
  await page.getByPlaceholder("Или введите свою...").fill("Backend engineer");
  await page.getByPlaceholder("Или введите свою...").press("Enter");
  await page.getByRole("combobox", { name: "Поиск навыка" }).fill("CSS");
  await page.getByRole("option", { name: /^CSS/ }).click();
  await page.getByRole("button", { name: "Добавить: Опыт работы" }).click();
  await page.getByLabel("Компания", { exact: true }).fill("Library");
  await page.getByLabel("Должность", { exact: true }).fill("Engineer");
  await page.getByLabel("Задачи и обязанности").fill("Build real APIs");
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Настроить виджеты" }).click();
  await page.getByRole("checkbox", { name: "Компании и интервью" }).uncheck();
  await expect(
    page.getByRole("checkbox", { name: "Компании и интервью" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByText("Компании и интервью", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/resume/new");
  await page
    .getByLabel("Название резюме", { exact: true })
    .fill("Backend application");
  await page.getByRole("button", { name: "Создать черновик" }).click();
  await expect(page).toHaveURL(/\/resume\/[^/]+\/edit$/);
  await expect(page.getByLabel("Компания", { exact: true })).toHaveValue(
    "Library",
  );
  await expect(page.getByLabel("Задачи и обязанности")).toHaveValue(
    "Build real APIs",
  );
  await page.goto("/resume");
  await page.getByRole("button", { name: "Название и статус" }).click();
  await page.getByLabel("Новый статус").selectOption("archived");
  await page.getByRole("button", { name: "Сохранить свойства" }).click();
  await expect(
    page.getByRole("region", { name: "Свойства резюме" }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Статус резюме").selectOption("archived");
  await expect(
    page.getByRole("link", { name: "Backend application", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Word", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.docx$/);
});

test("knowledge search and protected admin editor", async ({ page }) => {
  await register(page);
  await page.goto("/faq");
  await page
    .getByRole("textbox", { name: "Поиск в базе знаний" })
    .fill("Голосовой");
  await page.getByRole("link", { name: /Живой голосовой диалог с ИИ/ }).click();
  await expect(
    page.getByRole("heading", { name: "Подключение", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/knowledge");
  await expect(page.getByRole("alert")).toContainText(
    "Administrator access required",
  );
});

test("admin publishes and unpublishes articles", async ({ page }) => {
  test.skip(
    test.info().project.name !== "desktop",
    "One named admin in this isolated stack",
  );
  await page.request.post("/api/session");
  const email = "admin-e2e@example.test";
  expect(
    (
      await page.request.post("/api/auth/login", { data: { email, password } })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/admin/knowledge");
  const title = `Browser verified article ${Date.now()}`;
  await page.getByLabel("Заголовок", { exact: true }).fill(title);
  await page.getByLabel("Категория", { exact: true }).fill("Testing");
  await page
    .getByLabel("Текст статьи", { exact: false })
    .fill(
      "## A real article\n\nThis article is persisted in PostgreSQL and published by an administrator.",
    );
  await page.getByRole("checkbox", { name: "Публиковать" }).check();
  await page.getByRole("button", { name: "Сохранить статью" }).click();
  await expect(
    page.getByText("Статья опубликована", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.getByRole("checkbox", { name: "Публиковать" }).uncheck();
  await page.getByRole("button", { name: "Сохранить статью" }).click();
  await expect(
    page.getByText("Черновик сохранён", { exact: true }),
  ).toBeVisible();
  await page.goto("/faq");
  await page.getByRole("textbox", { name: "Поиск в базе знаний" }).fill(title);
  await expect(
    page.getByText(
      "Статей по этому запросу не найдено. Попробуйте другое слово.",
    ),
  ).toBeVisible();
});
