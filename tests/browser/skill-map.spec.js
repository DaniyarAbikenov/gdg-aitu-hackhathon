const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");

async function seed(page) {
  const profile = await page.request.post("/api/user/profile/update", {
    data: {
      revision: 0,
      profile: { full_name: "Map Candidate", skills: ["Python", "Git"] },
    },
  });
  expect(profile.ok()).toBeTruthy();
  for (const [name, skills] of [
    ["Backend developer", ["Python", "Docker", "PostgreSQL"]],
    ["Platform engineer", ["Docker", "Go"]],
  ]) {
    const saved = await page.request.post("/api/applications", {
      data: {
        name,
        company_name: "Atlas",
        description: "Build reliable services for the platform team.",
        skills,
      },
    });
    expect(saved.ok()).toBeTruthy();
  }
}

test("the skill map explains gaps and updates when a skill is added", async ({
  page,
}) => {
  await register(page);
  await seed(page);
  await page.goto("/skills");
  await expect(
    page.getByText(/is in your profile and asked for in 1 of 2/),
  ).toBeVisible();

  const map = page.getByRole("group", { name: /Skill map/ });
  await expect(map.getByRole("button")).toHaveCount(5);
  await page.getByRole("button", { name: "Docker · 2" }).click();
  const details = page.getByRole("region", { name: "Docker" });
  await expect(
    details.getByText(
      "Asked for in 2 of 2 saved vacancies and not in your profile yet.",
    ),
  ).toBeVisible();
  await details
    .getByRole("button", { name: "I know it: add to profile" })
    .click();
  await expect(
    details.getByText(
      "In your profile and asked for in 2 of 2 saved vacancies.",
    ),
  ).toBeVisible();

  await page.getByRole("tab", { name: "List" }).click();
  await expect(
    page.getByRole("table", { name: "Skill map" }).getByRole("row"),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Go" }).getByRole("link", {
      name: "Create a learning plan",
    }),
  ).toHaveAttribute("href", "/plan?focus=Go");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
