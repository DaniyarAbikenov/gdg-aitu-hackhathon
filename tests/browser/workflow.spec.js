const { test, expect } = require("@playwright/test");

test("sample → edit → review → PDF → reload → delete", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("Local reviewer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Alex Morgan");
  await page.getByLabel("Full name").fill("Alex Portfolio");
  await page.getByRole("button", { name: "Save your changes" }).click();
  await expect(
    page.getByText("Your changes are saved.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find my focus" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer path forward." }),
  ).toBeVisible();
  await expect(page.locator("#skill-match")).toContainText("Kubernetes");
  await expect(page.locator("#suggestions")).toContainText("real experience");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("resume.pdf");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");
  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Alex Portfolio");
  await expect(page.locator("#results")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Try a sample resume" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("bad upload produces a useful error and the next upload succeeds", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Local reviewer", { exact: true })).toBeVisible();
  await page.locator("#file").setInputFiles({
    name: "broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(page.locator("#notice")).toContainText("not a valid PDF");
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Alex Morgan");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
});
