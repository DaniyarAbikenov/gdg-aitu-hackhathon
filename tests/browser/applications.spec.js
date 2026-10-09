const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");

test("applications board moves a vacancy and the cover letter asks for facts first", async ({
  page,
}) => {
  await register(page);
  await page.goto("/applications");
  await page.getByRole("button", { name: "Add vacancy", exact: true }).click();
  await page.getByLabel("Position title", { exact: true }).fill("Board role");
  await page.getByLabel("Company", { exact: true }).fill("Atlas");
  await page
    .getByLabel("Job description", { exact: true })
    .fill("Build and maintain Python APIs");
  await page.getByRole("button", { name: "Save vacancy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Board role" }).first(),
  ).toBeVisible();

  // Without a profile or resume there are no facts, so nothing is invented.
  await page
    .getByRole("button", { name: "Draft a cover letter", exact: true })
    .click();
  await expect(
    page.getByText("Fill in your profile or choose a resume"),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Follow-ups (.ics)" }),
  ).toHaveAttribute("href", "/api/applications/calendar.ics");
  const calendar = await page.request.get("/api/applications/calendar.ics");
  expect(calendar.ok()).toBeTruthy();
  expect(await calendar.text()).toContain("BEGIN:VCALENDAR");

  await page.getByRole("button", { name: "Board", exact: true }).click();
  const board = page.getByLabel("Applications by stage");
  await board.getByLabel("Move Board role to stage").selectOption("interview");
  await expect(
    board
      .getByRole("region", { name: "Interview scheduled" })
      .getByText("Board role"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByLabel("Applications by stage")
      .getByRole("region", { name: "Interview scheduled" })
      .getByText("Board role"),
  ).toBeVisible();
});
