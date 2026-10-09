const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");

// Docker Compose sends email to Mailpit; its API exposes what was "sent".
const MAIL = process.env.MAIL_URL || "http://127.0.0.1:8025";

async function linkFrom(request, address, subject) {
  let text = "";
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAIL}/api/v1/search`, {
          params: { query: `to:"${address}" subject:"${subject}"` },
        });
        const [message] = (await search.json()).messages;
        if (!message) return "";
        const full = await request.get(`${MAIL}/api/v1/message/${message.ID}`);
        text = (await full.json()).Text;
        return text;
      },
      { timeout: 20000 },
    )
    .toContain("#token=");
  const url = new URL(text.match(/https?:\/\/\S+#token=\S+/)[0]);
  return url.pathname + url.hash;
}

test("email confirmation and password reset work through emailed links", async ({
  page,
  browser,
}) => {
  const email = await register(page);
  await page.goto(await linkFrom(page.request, email, "Confirm"));
  await expect(page.getByText("Your email is confirmed.")).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText("Email confirmed.")).toBeVisible();

  // A different browser, signed out, recovers the account.
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const guest = await context.newPage();
  await guest.addInitScript(() => localStorage.setItem("language", "en"));
  await guest.goto("/login");
  await guest.getByRole("link", { name: "Forgot password?" }).click();
  await guest.locator("#email").fill(email);
  await guest.getByRole("button", { name: "Send link", exact: true }).click();
  await expect(guest.getByRole("status")).toContainText("reset link");

  await guest.goto(await linkFrom(guest.request, email, "Reset"));
  // The token is removed from the address bar as soon as the page reads it.
  await expect(guest).toHaveURL(/\/reset-password$/);
  const fresh = "Recovered-password-42";
  await guest.locator("#password").fill(fresh);
  await guest.locator("#password2").fill(fresh);
  await guest
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(guest.getByText("every device was signed out")).toBeVisible();

  // The first browser's session ended with the old password.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await guest.getByRole("link", { name: "Back to sign in" }).click();
  await guest.locator("#email").fill(email);
  await guest.locator("#password").fill(fresh);
  await guest.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(guest).toHaveURL(/\/dashboard$/);
  await context.close();
});
