const { test, expect } = require("@playwright/test");
const { register, password } = require("./helpers");
test("public product page explains the workflow before sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "От выбранной вакансии — к уверенной подготовке.",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Начать подготовку", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
});
test("vacancy connects a manual resume, practice and learning after reload", async ({
  page,
}) => {
  await register(page);
  await page.goto("/applications");
  await page
    .getByRole("button", { name: "Добавить вакансию", exact: true })
    .click();
  await page
    .getByLabel("Название позиции", { exact: true })
    .fill("Junior Backend Developer");
  await page.getByLabel("Компания", { exact: true }).fill("Library team");
  await page
    .getByLabel("Описание вакансии", { exact: true })
    .fill("Build reliable Python APIs with PostgreSQL and automated tests.");
  await page.getByRole("combobox", { name: "Поиск навыка" }).fill("Python");
  await page.getByRole("option", { name: /^Python/ }).click();
  await page
    .getByLabel("Следующее действие", { exact: true })
    .fill("Review the application");
  await page
    .getByRole("button", { name: "Сохранить вакансию", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Подготовка к вакансии" }),
  ).toBeVisible();
  const applicationUrl = page.url();
  await page.getByRole("link", { name: "Собрать резюме", exact: true }).click();
  await expect(page.getByLabel("Целевая позиция", { exact: true })).toHaveValue(
    "Junior Backend Developer",
  );
  await page
    .getByRole("checkbox", { name: "Собрать и адаптировать с ИИ" })
    .uncheck();
  await page.getByRole("button", { name: "Создать черновик" }).click();
  await expect(page).toHaveURL(/\/resume\/[^/]+\/edit$/);
  await page.goto(applicationUrl);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Адаптировать резюме" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Начать тренировку", exact: true })
    .click();
  await expect(
    page.getByLabel("Название компании", { exact: true }),
  ).toHaveValue("Library team");
  await expect(
    page.getByLabel("Описание вакансии", { exact: true }),
  ).toHaveValue(
    "Build reliable Python APIs with PostgreSQL and automated tests.",
  );
  await page
    .getByRole("button", { name: "Начать интервью", exact: true })
    .click();
  await expect(page).toHaveURL(/\/interview\/session\?id=/);
  await page.goto(applicationUrl);
  await expect(
    page.getByRole("link", { name: /Тренировка 1 · Продолжить/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Создать план", exact: true }).click();
  await expect(page.getByLabel("Целевая позиция", { exact: true })).toHaveValue(
    "Junior Backend Developer",
  );
  await page.getByRole("button", { name: "Создать план", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\/[^/]+$/);
  await page.goto(applicationUrl);
  await expect(page.getByRole("link", { name: /Учебный план:/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Изменить вакансию", exact: true })
    .click();
  await page
    .getByLabel("Статус отклика", { exact: true })
    .selectOption("applied");
  await page
    .getByLabel("Дата следующего контакта", { exact: true })
    .fill("2026-12-01");
  await page
    .getByRole("button", { name: "Сохранить вакансию", exact: true })
    .click();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Следующие действия" }),
  ).toContainText("Review the application");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("account export, password change and confirmed deletion work through settings", async ({
  page,
}) => {
  const email = await register(page);
  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Скачать мои данные (JSON)" }).click();
  expect((await download).suggestedFilename()).toBe("careerbot-data.json");
  await page
    .getByRole("button", { name: "Сменить пароль", exact: true })
    .click();
  await page.getByLabel("Текущий пароль", { exact: true }).fill(password);
  await page
    .getByLabel("Новый пароль", { exact: true })
    .fill("Changed-test-password-43");
  await page.getByRole("button", { name: "Сохранить новый пароль" }).click();
  await expect(page).toHaveURL(/\/login\?account=password-changed/);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Changed-test-password-43");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Удалить аккаунт", exact: true })
    .click();
  await page
    .getByLabel("Текущий пароль", { exact: true })
    .fill("Changed-test-password-43");
  await page.getByLabel("Введите email аккаунта для подтверждения").fill(email);
  await page
    .getByRole("button", { name: "Удалить мои данные и аккаунт" })
    .click();
  await expect(page).toHaveURL(/\/login\?account=deleted/);
});
