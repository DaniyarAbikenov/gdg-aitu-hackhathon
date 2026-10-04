const { expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const password = "Portfolio-test-password-42";
async function register(page) {
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.goto("/register");
  const email = `${randomUUID()}@example.com`;
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#password2").fill(password);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.locator("#name")).toBeVisible();
  return email;
}
module.exports = { register, password };
