const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");
test("interview reloads from PostgreSQL, feedback and plan progress persist", async ({
  page,
}) => {
  await register(page);
  // Explicit deterministic provider is enabled only in this isolated test stack.
  await page.goto("/interview/start");
  await page.locator("textarea").nth(0).fill("Library engineering team");
  await page
    .locator("textarea")
    .nth(1)
    .fill("Build reliable Python APIs using PostgreSQL");
  await page.locator("textarea").nth(2).fill("Python, PostgreSQL");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/interview\/session\?id=/);
  await page.reload();
  for (let i = 0; i < 3; i++) {
    await page
      .getByPlaceholder("Your answer…")
      .fill(
        "problem contribution decision result assumptions approach alternatives verify test failure monitor rollback",
      );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    if (i < 2)
      await expect(page.getByPlaceholder("Your answer…")).toBeEnabled();
  }
  await expect(page).toHaveURL(/\/interview\/result\?id=/);
  await page.getByRole("button", { name: "View Summary" }).click();
  await page.reload();
  await expect(page.getByText(/100\/100/)).toBeVisible();
  const profile = await (await page.request.get("/api/user/profile")).json();
  expect(
    (
      await page.request.post("/api/user/profile/update", {
        data: {
          revision: profile.revision,
          profile: {
            ...profile.data,
            career_goal: "Backend developer",
            language: "en",
          },
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\/[^/]+$/);
  await page.getByRole("checkbox").first().click();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.goto("/progress");
  await expect(page.getByText("1 / 8", { exact: true })).toBeVisible();
});
test("protected routes and unavailable Google login never fake success", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.goto("/interview/session?id=missing");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByRole("button", { name: "Sign in with Google", exact: false })
    .click();
  await expect(
    page.getByText("Google sign-in is not configured on this server.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
