import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { ProfileChanges } from "@/api/types";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import { ProfileUpdates } from "./ProfileUpdates";

const job = { company: "Library", role: "Engineer", responsibilities: "APIs" };

const changes: ProfileChanges = {
  resume_id: "r1",
  revision: 4,
  profile_revision: 7,
  linked: true,
  status: "review",
  changes: [
    {
      id: "review:summary:summary",
      kind: "review",
      section: "summary",
      key: "summary",
      label: "summary",
      resume: "Backend developer for search",
      profile: "Backend developer, Python",
      demand: 0,
    },
    {
      id: "update:experience:job1",
      kind: "update",
      section: "experience",
      key: "job1",
      label: "Engineer, Library",
      resume: job,
      profile: { ...job, role: "Senior Engineer" },
      demand: 0,
    },
    {
      id: "new:skills:docker",
      kind: "new",
      section: "skills",
      key: "docker",
      label: "Docker",
      resume: null,
      profile: "Docker",
      demand: 2,
    },
  ],
};

describe("ProfileUpdates", () => {
  it("applies only the decisions the candidate made", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get("*/api/resume/r1/profile-changes", () =>
        HttpResponse.json(body ? { ...changes, changes: [] } : changes),
      ),
      http.post("*/api/resume/r1/profile-changes", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ resume_id: "r1", revision: 5, fields: {} });
      }),
    );
    const onApplied = vi.fn();
    renderWithProviders(
      <ProfileUpdates resumeId="r1" dirty={false} onApplied={onApplied} />,
    );

    const update = await screen.findByRole("radiogroup", {
      name: "Engineer, Library",
    });
    expect(
      within(update).getByRole("radio", { name: "Update the resume" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Asked for in 2 saved vacancies")).toBeVisible();
    const review = screen.getByRole("radiogroup", { name: "summary" });
    expect(
      within(review)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-checked")),
    ).toEqual(["false", "false"]);

    await user.click(
      within(review).getByRole("radio", { name: "Keep the resume text" }),
    );
    await user.click(screen.getByRole("radio", { name: "Add to the resume" }));
    await user.click(
      screen.getByRole("button", { name: "Save decisions (3)" }),
    );

    expect(await screen.findByText(/previous text is in/)).toBeVisible();
    expect(body).toEqual({
      revision: 4,
      accept: ["update:experience:job1", "new:skills:docker"],
      dismiss: ["review:summary:summary"],
      label: "Before the profile update",
    });
    expect(onApplied).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 5 }),
    );
  });

  it("asks to save editor changes first", async () => {
    server.use(
      http.get("*/api/resume/r1/profile-changes", () =>
        HttpResponse.json(changes),
      ),
    );
    renderWithProviders(
      <ProfileUpdates resumeId="r1" dirty onApplied={() => {}} />,
    );
    expect(await screen.findByText(/Save your edits/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Save decisions/ }),
    ).toBeDisabled();
  });
});
