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
  await page.getByPlaceholder("Or enter your own…").fill("Backend developer");
  await page.getByPlaceholder("Or enter your own…").press("Enter");
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
    page.getByRole("link", { name: "Experience and profile data" }),
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
  if (test.info().project.name === "desktop") {
    const bytes = [
      ...require("node:fs").readFileSync(
        path.join(__dirname, "../fixtures/resume.pdf"),
      ),
    ];
    const transfer = await page.evaluateHandle((data) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(data)], "resume.pdf", {
          type: "application/pdf",
        }),
      );
      return transfer;
    }, bytes);
    await page
      .locator("section")
      .filter({ has: page.locator("#resume-upload") })
      .dispatchEvent("drop", { dataTransfer: transfer });
  } else {
    await page
      .locator("#resume-upload")
      .setInputFiles(path.join(__dirname, "../fixtures/resume.pdf"));
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/resume\/[^/]+\/edit$/);
  await page
    .getByLabel("About me", { exact: true })
    .fill("Verified portfolio summary");
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/save") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await saved;
  await page.reload();
  await expect(page.getByLabel("About me", { exact: true })).toHaveValue(
    "Verified portfolio summary",
  );
  await page.getByRole("button", { name: "Versions", exact: true }).click();
  await page.getByRole("button", { name: "Save current version" }).click();
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await page.reload();
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
