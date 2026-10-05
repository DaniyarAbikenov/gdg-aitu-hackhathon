const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");
test("company assignments persist and prefill interview and vacancy forms", async ({
  page,
}) => {
  await register(page);
  await page.goto("/companies");
  await page.getByRole("button", { name: "Add company", exact: true }).click();
  await page.getByLabel("Company name", { exact: true }).fill("Atlas Studio");
  await page
    .getByLabel("About the company", { exact: true })
    .fill("Platform engineering team");
  await page.getByRole("combobox", { name: "Search skills" }).fill("Python");
  await page.getByRole("option", { name: /^Python/ }).click();
  await page
    .getByLabel("Hiring process", { exact: true })
    .fill("Code review and team discussion");
  await page
    .getByRole("button", { name: "Add assignment", exact: true })
    .click();
  await page
    .getByLabel("Assignment title", { exact: true })
    .fill("Build an API");
  await page
    .getByLabel("Brief and criteria", { exact: true })
    .fill("Implement pagination with tests");
  await page
    .getByLabel("Assignment source", { exact: true })
    .fill("https://example.com/task");
  await page.getByRole("button", { name: "Save company", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Company details" }),
  ).toBeVisible();
  const url = page.url();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Build an API" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Practice for this company", exact: true })
    .click();
  await expect(page.getByLabel("Company name", { exact: true })).toHaveValue(
    "Atlas Studio",
  );
  await expect(page.getByRole("button", { name: "Python ×" })).toBeVisible();
  await page.goto(url);
  await page.getByRole("link", { name: "Add a company vacancy" }).click();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Atlas Studio",
  );
});
test("skill popup dismisses outside, with Tab and Escape; languages preserve draft", async ({
  page,
}) => {
  await register(page);
  await page.goto("/companies");
  await page.getByRole("button", { name: "Add company", exact: true }).click();
  await page
    .getByLabel("Company name", { exact: true })
    .fill("Unsaved company");
  const search = page.getByRole("combobox", { name: "Search skills" });
  await search.fill("css");
  await expect(page.getByRole("listbox", { name: "Skills" })).toBeVisible();
  await page.getByRole("heading", { name: "Company atlas" }).click();
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.focus();
  await search.press("Escape");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.focus();
  await page.getByLabel("Hiring process", { exact: true }).focus();
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("menuitem", { name: "Қазақша" }).click();
  await expect(
    page.getByRole("heading", { name: "Компаниялар атласы" }),
  ).toBeVisible();
  await expect(page.getByLabel("Компания атауы", { exact: true })).toHaveValue(
    "Unsaved company",
  );
  await page.getByRole("button", { name: "Қазақша", exact: true }).click();
  await page.getByRole("menuitem", { name: "Русский" }).click();
  await expect(
    page.getByRole("heading", { name: "Атлас компаний" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Название компании", { exact: true }),
  ).toHaveValue("Unsaved company");
  await page.getByRole("button", { name: "Русский", exact: true }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await expect(
    page.getByRole("heading", { name: "Company atlas" }),
  ).toBeVisible();
});
test("import preview is explicit and reviewable before creating vacancy", async ({
  page,
}) => {
  await register(page);
  // Browser boundary fixture only; backend extraction/SSRF contracts have separate tests.
  await page.route("**/api/applications/import", (r) =>
    r.fulfill({
      json: {
        draft: {
          name: "Imported role",
          company_name: "Atlas",
          description: "Build reliable Python APIs",
          skills: ["Python"],
          location: "Remote",
          employment: "Full time",
          salary: "",
          requirements: ["Python"],
          responsibilities: ["Build APIs"],
        },
        source_url: "https://example.com/job",
        provider: "openai",
      },
    }),
  );
  await page.goto("/applications");
  await page.getByRole("button", { name: "Add vacancy", exact: true }).click();
  await page
    .getByLabel("Import link", { exact: true })
    .fill("https://example.com/job");
  await page
    .getByRole("button", { name: "Parse with AI", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Vacancy preview" }),
  ).toBeVisible();
  await expect(page.getByLabel("Position title", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByRole("button", { name: "Apply to form", exact: true })
    .click();
  await expect(page.getByLabel("Position title", { exact: true })).toHaveValue(
    "Imported role",
  );
  await expect(page.getByLabel("Requirements", { exact: true })).toHaveValue(
    "Python",
  );
  await page
    .getByLabel("Position title", { exact: true })
    .fill("Confirmed role");
  await page.getByRole("button", { name: "Save vacancy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Confirmed role" }).first(),
  ).toBeVisible();
});
test("English interface and knowledge contain no leftover Russian UI", async ({
  page,
}) => {
  await register(page);
  for (const route of [
    "/dashboard",
    "/companies",
    "/applications",
    "/resume",
    "/resume/new",
    "/interview/start",
    "/plan",
    "/progress",
    "/settings",
    "/faq",
    "/about",
  ]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const text = await page.locator("body").innerText();
    expect(text, route).not.toMatch(/[А-Яа-яЁё]/);
    expect(text, route).not.toMatch(/copy\.c\d+|nextStep\./);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBeTruthy();
  }
});
