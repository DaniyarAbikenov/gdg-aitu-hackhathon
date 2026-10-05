const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");

test("shared skill descriptions, fuzzy suggestions and case-insensitive selection", async ({
  page,
}) => {
  await register(page);
  const input = page.getByRole("combobox", { name: "Search skills" });
  await input.fill("css");
  await expect(page.getByRole("option", { name: /^CSS/ })).toContainText(
    "A style language",
  );
  await input.press("ArrowDown");
  await input.press("Enter");
  await input.fill("CSS");
  await page.getByRole("option", { name: /^CSS/ }).click();
  await expect(page.getByText("CSS", { exact: true })).toHaveCount(1);
  await input.fill("Javascrip");
  await expect(page.getByRole("option", { name: /^JavaScript/ })).toBeVisible();
  const name = `Skill ${Date.now()} ${test.info().project.name}`;
  await input.fill(name);
  const description =
    test.info().project.name === "mobile"
      ? "A shared description for this new skill."
      : "";
  if (description)
    await page
      .getByRole("textbox", { name: "New skill description" })
      .fill(description);
  await page.getByRole("button", { name: "Add new skill" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.reload();
  await input.fill(name.toLowerCase());
  await expect(page.getByRole("option", { name })).toBeVisible();
  if (description)
    await expect(page.getByRole("option", { name })).toContainText(description);
});
