const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");

async function seedProfile(page) {
  const saved = await page.request.post("/api/user/profile/update", {
    data: {
      revision: 0,
      profile: {
        full_name: "Existing Candidate",
        desired_position: "Engineer",
        skills: ["CSS"],
        language: "en",
      },
    },
  });
  expect(saved.ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator("#name")).toHaveValue("Existing Candidate");
}

test("month and year pickers persist precise and ongoing work periods", async ({
  page,
}) => {
  await register(page);
  await seedProfile(page);
  await page
    .getByRole("button", { name: "Add: Work experience", exact: true })
    .click();
  await page
    .getByLabel("Start date: Year", { exact: true })
    .selectOption("2022");
  await page
    .getByLabel("Start date: Month", { exact: true })
    .selectOption("03");
  await page.getByLabel("End date: Year", { exact: true }).selectOption("2021");
  await expect(
    page.getByRole("alert").filter({ hasText: "cannot precede" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Present", exact: true }).check();
  await page
    .getByRole("button", { name: "Add: Education", exact: true })
    .click();
  await page.getByLabel("Start year", { exact: true }).selectOption("2018");
  await page
    .getByLabel("Graduation year", { exact: true })
    .selectOption("2022");
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const result = await (await page.request.get("/api/user/profile")).json();
  expect(result.data.experience[0]).toMatchObject({
    date_from: "2022-03",
    date_to: "present",
  });
  expect(result.data.education[0]).toMatchObject({
    year_start: 2018,
    year_end: 2022,
  });
  await page.goto("/onboarding");
  await expect(
    page.getByLabel("Start date: Month", { exact: true }),
  ).toHaveValue("03");
  await expect(
    page.getByRole("checkbox", { name: "Present", exact: true }),
  ).toBeChecked();
});

test("PDF facts are reviewed, merged without overwrites, and saved explicitly", async ({
  page,
}) => {
  await register(page);
  await seedProfile(page);
  // UI fixture only: real PDF bytes/AI transport are verified by backend integration tests.
  await page.route("**/api/user/profile/import", (route) =>
    route.fulfill({
      json: {
        filename: "resume.pdf",
        provider: "openai",
        fields: {
          full_name: "Name from PDF",
          position: "Engineer",
          skills: ["css", "Python"],
          experience: [
            {
              company: "Library",
              role: "Engineer",
              date_from: "2020",
              date_to: "2022-03",
              location: "Remote",
              responsibilities: "Built APIs",
              achievements: [],
            },
          ],
        },
      },
    }),
  );
  const upload = async () => {
    const input = page.getByLabel("Choose profile PDF", { exact: true });
    await expect(input).toBeEnabled();
    await input.setInputFiles("tests/fixtures/resume.pdf");
  };
  await upload();
  const preview = page.getByRole("region", {
    name: "Review PDF facts",
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(
    preview.getByRole("checkbox", { name: "Name", exact: true }),
  ).not.toBeChecked();
  expect(
    (await (await page.request.get("/api/user/profile")).json()).revision,
  ).toBe(1);
  await page
    .getByRole("button", {
      name: "Apply selected facts to profile",
      exact: true,
    })
    .click();
  await expect(page.locator("#name")).toHaveValue("Existing Candidate");
  await expect(
    page.getByLabel("Start date: Year", { exact: true }),
  ).toHaveValue("2020");
  await expect(
    page.getByLabel("Start date: Month", { exact: true }),
  ).toHaveValue("");
  await upload();
  await expect(preview).toBeVisible();
  await page
    .getByRole("button", {
      name: "Apply selected facts to profile",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Start date: Year", { exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const result = await (await page.request.get("/api/user/profile")).json();
  expect(result.data.full_name).toBe("Existing Candidate");
  expect(result.data.skills).toEqual(["CSS", "Python"]);
  expect(result.data.experience).toHaveLength(1);
  expect(result.data.experience[0].date_from).toBe("2020");
});
