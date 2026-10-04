const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { register, password } = require("./helpers");
test("original frontend registers, persists profile and supports login", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = await register(page);
  await page.locator("#name").fill("Alex Portfolio");
  await page.getByPlaceholder("Или введите свою...").fill("Backend developer");
  await page.getByPlaceholder("Или введите свою...").press("Enter");
  await page.getByPlaceholder("Search for a skill").fill("Python");
  await page.getByRole("option", { name: /^Python/ }).click();
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByText("Backend developer", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Backend developer", { exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Опыт и данные профиля" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByText("Backend developer", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("upload, structured edit, saved version and actual PDF download", async ({
  page,
}) => {
  await register(page);
  await page.goto("/resume");
  await page
    .locator("#resume-upload")
    .setInputFiles(path.join(__dirname, "../fixtures/resume.pdf"));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/resume\/[^/]+\/edit$/);
  await page
    .getByLabel("О себе", { exact: true })
    .fill("Verified portfolio summary");
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/save") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await saved;
  await page.reload();
  await expect(page.getByLabel("О себе", { exact: true })).toHaveValue(
    "Verified portfolio summary",
  );
  await page.getByRole("button", { name: "Версии", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить текущую версию" }).click();
  await expect(page.getByText("Версия 1", { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await page.reload();
  await expect(page.getByText("Версия 1", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
