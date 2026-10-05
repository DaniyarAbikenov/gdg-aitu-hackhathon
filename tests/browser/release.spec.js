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
  await page.getByRole("button", { name: "Add vacancy", exact: true }).click();
  await page
    .getByLabel("Position title", { exact: true })
    .fill("Junior Backend Developer");
  await page.getByLabel("Company", { exact: true }).fill("Library team");
  await page
    .getByLabel("Job description", { exact: true })
    .fill("Build reliable Python APIs with PostgreSQL and automated tests.");
  await page.getByRole("combobox", { name: "Search skills" }).fill("Python");
  await page.getByRole("option", { name: /^Python/ }).click();
  await page
    .getByLabel("Next action", { exact: true })
    .fill("Review the application");
  await page.getByRole("button", { name: "Save vacancy", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Vacancy preparation" }),
  ).toBeVisible();
  const applicationUrl = page.url();
  await page.getByRole("link", { name: "Build resume", exact: true }).click();
  await expect(page.getByLabel("Target position", { exact: true })).toHaveValue(
    "Junior Backend Developer",
  );
  await page
    .getByRole("checkbox", { name: "Build and tailor with AI" })
    .uncheck();
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/resume\/[^/]+\/edit$/);
  await page.goto(applicationUrl);
  await page.reload();
  await expect(page.getByRole("link", { name: "Tailor resume" })).toBeVisible();
  await page.getByRole("link", { name: "Start practice", exact: true }).click();
  await expect(page.getByLabel("Company name", { exact: true })).toHaveValue(
    "Library team",
  );
  await expect(page.getByLabel("Job description", { exact: true })).toHaveValue(
    "Build reliable Python APIs with PostgreSQL and automated tests.",
  );
  await page
    .getByRole("button", { name: "Start interview", exact: true })
    .click();
  await expect(page).toHaveURL(/\/interview\/session\?id=/);
  await page.goto(applicationUrl);
  await expect(
    page.getByRole("link", { name: /Practice 1.*Continue/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create plan", exact: true }).click();
  await expect(page.getByLabel("Target position", { exact: true })).toHaveValue(
    "Junior Backend Developer",
  );
  await page.getByRole("button", { name: "Create plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\/[^/]+$/);
  await page.goto(applicationUrl);
  await expect(
    page.getByRole("link", { name: /Learning plan:/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit vacancy", exact: true }).click();
  await page
    .getByLabel("Application stage", { exact: true })
    .selectOption("applied");
  await page
    .getByLabel("Next contact date", { exact: true })
    .fill("2026-12-01");
  await page.getByRole("button", { name: "Save vacancy", exact: true }).click();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Next actions" }),
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
  await page.getByRole("link", { name: "Download my data (JSON)" }).click();
  expect((await download).suggestedFilename()).toBe("careerbot-data.json");
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page
    .getByLabel("New password", { exact: true })
    .fill("Changed-test-password-43");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/login\?account=password-changed/);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Changed-test-password-43");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page
    .getByLabel("Current password", { exact: true })
    .fill("Changed-test-password-43");
  await page.getByLabel("Enter your account email to confirm").fill(email);
  await page
    .getByRole("button", { name: "Delete my data and account" })
    .click();
  await expect(page).toHaveURL(/\/login\?account=deleted/);
});
