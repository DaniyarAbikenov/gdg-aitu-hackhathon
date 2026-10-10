const { test, expect } = require("@playwright/test");
const { register } = require("./helpers");

async function saveProfile(page, changes) {
  const current = await (await page.request.get("/api/user/profile")).json();
  const saved = await page.request.post("/api/user/profile/update", {
    data: {
      revision: current.revision,
      profile: { ...current.data, ...changes },
    },
  });
  expect(saved.ok()).toBeTruthy();
  return (await saved.json()).data;
}

test("a resume takes chosen profile facts and offers later profile updates", async ({
  page,
}) => {
  await register(page);
  const profile = await saveProfile(page, {
    full_name: "Aru Example",
    desired_position: "Backend developer",
    summary: "Backend developer",
    skills: ["Python", "SQL"],
    interests: ["Chess"],
    language: "en",
    experience: [
      { company: "Library", role: "Engineer", responsibilities: "Build APIs" },
      { company: "Cafe", role: "Barista", responsibilities: "Coffee" },
    ],
  });

  await page.goto("/resume/new");
  await page.getByLabel("Resume title").fill("Backend");
  await page.getByLabel("Target position").fill("Backend developer");
  const ai = page.getByLabel("Build and tailor with AI");
  if (await ai.isEnabled()) await ai.uncheck();
  await expect(
    page.getByRole("checkbox", { name: /Interests/ }),
  ).not.toBeChecked();
  await page
    .getByRole("list", { name: "Entries of Work experience" })
    .getByRole("checkbox", { name: /Barista/ })
    .uncheck();
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/resume\/[^/]+\/edit$/);
  const resumeId = page.url().split("/").at(-2);
  await expect(
    page.getByText("The resume matches your profile."),
  ).toBeVisible();
  const created = await (
    await page.request.get(`/api/resume/${resumeId}`)
  ).json();
  expect(created.fields.experience.map((e) => e.company)).toEqual(["Library"]);

  await saveProfile(page, {
    skills: ["Python", "SQL", "Docker"],
    experience: [
      { ...profile.experience[0], role: "Senior Engineer" },
      profile.experience[1],
    ],
  });
  await page.reload();
  const updates = page.getByRole("region", {
    name: "Updates from your profile",
  });
  await expect(
    updates
      .getByRole("radiogroup", { name: /Library/ })
      .getByRole("radio", { name: "Update the resume" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(updates.getByText(/Senior Engineer/).first()).toBeVisible();
  await updates
    .getByRole("radiogroup", { name: "Docker" })
    .getByRole("radio", { name: "Add to the resume" })
    .click();
  await updates.getByRole("button", { name: "Save decisions (2)" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "The previous text is in the version history." }),
  ).toBeVisible();

  const updated = await (
    await page.request.get(`/api/resume/${resumeId}`)
  ).json();
  expect(updated.fields.experience[0].role).toBe("Senior Engineer");
  expect(updated.fields.skills).toContain("Docker");
  await page.goto(`/resume/${resumeId}`);
  await expect(
    page.getByRole("heading", { name: "Before the profile update" }),
  ).toBeVisible();
});
