const { test, expect } = require("@playwright/test");
const { register, password } = require("./helpers");

async function company(page, name) {
  // A private address is never fetched, so the research error path is deterministic.
  const response = await page.request.post("/api/companies", {
    data: { name, website: "http://127.0.0.1/" },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("candidates share anonymous interview reports that appear after moderation", async ({
  page,
  browser,
  baseURL,
}) => {
  const name = `Insight Co ${Date.now()}`;
  // Long digit runs read as phone numbers, so the unique part uses letters.
  const role = `QA engineer ${Math.random()
    .toString(36)
    .replace(/[^a-z]/g, "")}`;
  await register(page);
  const created = await company(page, name);
  await page.goto(`/companies?id=${created.id}`);

  await page.getByRole("button", { name: "Read the website" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Could not read the company website. Check the address or add facts by hand.",
  );

  await page.getByRole("button", { name: "Share your interview" }).click();
  const form = page.getByRole("form", { name: "Share an interview report" });
  await expect(form.getByText(/Reports are anonymous/)).toBeVisible();
  await form.getByLabel("Role").fill(role);
  await form.getByLabel("Questions").fill("How would you test a login form?");
  await form.getByLabel("Advice").fill("Mail me at someone@example.com");
  await form.getByRole("button", { name: "Send for moderation" }).click();
  await expect(form.getByRole("alert")).toHaveText(
    "Remove contact details and links: reports are anonymous.",
  );
  await form.getByLabel("Advice").fill("Bring test case examples.");
  await form.getByRole("button", { name: "Send for moderation" }).click();
  await expect(page.getByText(/after moderation/)).toBeVisible();
  await expect(page.getByText("Waiting for moderation")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();

  test.skip(
    test.info().project.name !== "desktop",
    "One named admin in this isolated stack",
  );
  const admin = await (await browser.newContext({ baseURL })).newPage();
  await admin.addInitScript(() => localStorage.setItem("language", "en"));
  await admin.request.post("/api/session");
  expect(
    (
      await admin.request.post("/api/auth/login", {
        data: { email: "admin-e2e@example.test", password },
      })
    ).ok(),
  ).toBeTruthy();
  await admin.goto("/admin/reports");
  const card = admin.getByRole("article").filter({ hasText: role });
  await expect(card.getByText("Bring test case examples.")).toBeVisible();
  await card.getByRole("button", { name: "Publish" }).click();
  await expect(card).toHaveCount(0);
  await admin.context().close();

  const other = await (await browser.newContext({ baseURL })).newPage();
  await register(other);
  const theirs = await company(other, name.toUpperCase());
  await other.goto(`/companies?id=${theirs.id}`);
  const report = other.getByRole("article").filter({ hasText: role });
  await expect(
    report.getByText("How would you test a login form?"),
  ).toBeVisible();
  await expect(report.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await other.context().close();
});
