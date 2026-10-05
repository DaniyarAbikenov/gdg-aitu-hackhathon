const { test, expect } = require("@playwright/test");
const { register, password } = require("./helpers");

test("profile blocks, resume creation, archive and dashboard preferences persist", async ({
  page,
}) => {
  await register(page);
  await page.locator("#name").fill("Profile Candidate");
  await page.getByPlaceholder("Or enter your own…").fill("Backend engineer");
  await page.getByPlaceholder("Or enter your own…").press("Enter");
  await page.getByRole("combobox", { name: "Search skills" }).fill("CSS");
  await page.getByRole("option", { name: /^CSS/ }).click();
  await page.getByRole("button", { name: "Add: Work experience" }).click();
  await page.getByLabel("Company", { exact: true }).fill("Library");
  await page.getByLabel("Role", { exact: true }).fill("Engineer");
  await page.getByLabel("Tasks and responsibilities").fill("Build real APIs");
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Customize widgets" }).click();
  await page
    .getByRole("checkbox", { name: "Companies and interviews" })
    .uncheck();
  await expect(
    page.getByRole("checkbox", { name: "Companies and interviews" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByText("Companies and interviews", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/resume/new");
  await page
    .getByLabel("Resume title", { exact: true })
    .fill("Backend application");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/resume\/[^/]+\/edit$/);
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Library",
  );
  await expect(page.getByLabel("Tasks and responsibilities")).toHaveValue(
    "Build real APIs",
  );
  await page.goto("/resume");
  await page.getByRole("button", { name: "Title and status" }).click();
  await page.getByLabel("New status").selectOption("archived");
  await page.getByRole("button", { name: "Save properties" }).click();
  await expect(
    page.getByRole("region", { name: "Resume properties" }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Resume status").selectOption("archived");
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
    .getByRole("textbox", { name: "Search the knowledge base" })
    .fill("practice");
  await page
    .getByRole("link", { name: /Interview practice, learning and progress/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Practice deliberately", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/knowledge");
  await expect(page.getByRole("alert")).toContainText("Action unavailable");
});

test("admin publishes and unpublishes articles", async ({ page }) => {
  test.skip(
    test.info().project.name !== "desktop",
    "One named admin in this isolated stack",
  );
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.request.post("/api/session");
  const email = "admin-e2e@example.test";
  expect(
    (
      await page.request.post("/api/auth/login", { data: { email, password } })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/admin/knowledge");
  const title = `Browser verified article ${Date.now()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Category", { exact: true }).fill("Testing");
  await page
    .getByLabel("Article body", { exact: false })
    .fill(
      "## A real article\n\nThis article is persisted in PostgreSQL and published by an administrator.",
    );
  await page.getByLabel("Article language").selectOption("en");
  await page.getByRole("checkbox", { name: "Publish" }).check();
  await page.getByRole("button", { name: "Save article" }).click();
  await expect(
    page.getByText("Article published", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.getByRole("checkbox", { name: "Publish" }).uncheck();
  await page.getByRole("button", { name: "Save article" }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page.goto("/faq");
  await page
    .getByRole("textbox", { name: "Search the knowledge base" })
    .fill(title);
  await expect(
    page.getByText("No articles match this search. Try another word."),
  ).toBeVisible();
});
