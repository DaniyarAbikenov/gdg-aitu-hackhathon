const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");

const VACANCY = {
  name: "Funnel role",
  company_name: "Atlas",
  description: "Build and maintain Python APIs with PostgreSQL.",
};

async function move(page, status, id, revision) {
  const response = id
    ? await page.request.put(`/api/applications/${id}`, {
        data: { ...VACANCY, status, revision },
      })
    : await page.request.post("/api/applications", {
        data: { ...VACANCY, status },
      });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("a rejection review leads to a next step and the funnel keeps the stage", async ({
  page,
}) => {
  await register(page);
  let vacancy = await move(page, "applied");
  vacancy = await move(page, "interview", vacancy.id, vacancy.revision);
  vacancy = await move(page, "rejected", vacancy.id, vacancy.revision);

  await page.goto(`/applications?id=${vacancy.id}`);
  const review = page.getByRole("form", {
    name: "What happened with this application?",
  });
  await expect(
    review.getByRole("radio", { name: "After an interview" }),
  ).toBeChecked();
  await review.getByRole("radio", { name: "Technical interview" }).check();
  await review
    .getByRole("textbox", { name: "Topics that felt weak" })
    .fill("SQL joins\nIndexes");
  await review.getByRole("button", { name: "Get my next step" }).click();
  await expect(
    page.getByText("Build a learning plan around: SQL joins, Indexes."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create the plan" }).click();
  await expect(page).toHaveURL(/\/plan\?vacancy=.+&focus=/);

  await page.goto("/applications/funnel");
  await expect(page.getByText("Interview: 1", { exact: true })).toBeVisible();
  await expect(page.getByText("After an interview: 1")).toBeVisible();
  await expect(page.getByText("Technical interview: 1")).toBeVisible();
  await expect(
    page.getByText("Rejections you turned into a concrete next step: 1."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
