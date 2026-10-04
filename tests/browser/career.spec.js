const { test, expect } = require("@playwright/test");

async function tab(page, name) {
  await page
    .getByRole("navigation", { name: "Career workspace" })
    .getByRole("button", { name, exact: true })
    .click();
}

test("profile → interview → feedback → plan → progress persists", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Local reviewer", { exact: true })).toBeVisible();
  await tab(page, "Profile & goal");
  await page.getByLabel("Name", { exact: true }).fill("Alex Career");
  await page
    .getByLabel("Target role", { exact: true })
    .fill("Backend developer");
  await page
    .getByLabel("Career goal", { exact: true })
    .fill("Build reliable Python APIs");
  await page.getByLabel("Skills (comma separated)").fill("Python, PostgreSQL");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator("#notice")).toContainText("Profile saved");
  await tab(page, "Interview");
  await page.getByLabel("Company and context").fill("Library team");
  await page
    .getByRole("button", { name: "Start interview", exact: true })
    .click();
  for (const answer of [
    "The problem and contribution involved a decision with a measured result.",
    "State assumptions, describe the approach, alternatives and verify.",
    "Test failure cases, monitor the service and rollback.",
  ]) {
    await page.getByLabel("Your answer", { exact: true }).fill(answer);
    await page
      .getByRole("button", { name: "Submit answer", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Interview summary", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Practice score: 100/100", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Build a learning plan from this interview" })
    .click();
  await expect(page.getByLabel("Learning goal", { exact: true })).toHaveValue(
    "Build reliable Python APIs",
  );
  await page
    .getByRole("button", { name: "Create learning plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "0 / 8 weeks complete" }),
  ).toBeVisible();
  await page
    .getByLabel("Your notes / evidence")
    .first()
    .fill("Implemented a tested API");
  await page
    .getByRole("button", { name: "Complete week", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "1 / 8 weeks complete" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export plan", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("career-plan.txt");
  await tab(page, "Progress");
  await expect(page.getByText("1/8", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Claim milestone" }).first().click();
  await expect(page.getByText("Claimed ✓")).toBeVisible();
  await page.reload();
  await tab(page, "Progress");
  await expect(page.getByText("1/8", { exact: true })).toBeVisible();
  await expect(page.getByText("Claimed ✓")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  await page.request.delete("/api/session");
});

test("versions preserve the original and restore reviewed edits", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Local reviewer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await page
    .getByRole("button", { name: "Save a version", exact: true })
    .click();
  await expect(page.locator("#version-list summary")).toHaveCount(1);
  await page.getByLabel("Full name", { exact: true }).fill("Alex Changed");
  await page.getByRole("button", { name: "Save your changes" }).click();
  await expect(page.locator("#notice")).toContainText("Your changes are saved");
  await page.locator("#version-list summary").click();
  await page.getByRole("button", { name: "Make this version active" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
  await expect(page.locator("#notice")).toContainText("Version restored");
  if (
    !(await page
      .getByRole("button", { name: "Download this version" })
      .isVisible())
  )
    await page.locator("#version-list summary").click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download this version" }).click();
  expect((await download).suggestedFilename()).toBe("resume-version.pdf");
  await page
    .getByRole("button", { name: "Delete version", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.locator("#version-list")).toContainText(
    "No saved versions yet",
  );
  await page.request.delete("/api/session");
});

test("account sign-in preserves language preferences across sessions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Local reviewer", { exact: true })).toBeVisible();
  await tab(page, "Account");
  const email = `browser-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.getByLabel("Account email", { exact: true }).fill(email);
  await page
    .getByLabel("Password (at least 12 characters)")
    .fill("a long browser test password");
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Create account", exact: true }).click(),
  ]);
  await expect(page.getByText("Local reviewer", { exact: true })).toBeVisible();
  await page.locator("#ui-language").selectOption("ru");
  await expect(
    page.getByRole("button", { name: "Аккаунт", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Аккаунт", exact: true }).click();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Выйти", exact: true }).click(),
  ]);
  await expect(page.getByText("Local reviewer", { exact: true })).toBeVisible();
  await tab(page, "Account");
  await page.getByLabel("Account email", { exact: true }).fill(email);
  await page
    .getByLabel("Password (at least 12 characters)")
    .fill("a long browser test password");
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("button", { name: "Аккаунт", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#ui-language")).toHaveValue("ru");
  await page.request.delete("/api/session");
});
