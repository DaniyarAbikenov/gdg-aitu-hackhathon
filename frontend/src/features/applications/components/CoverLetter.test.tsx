import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ApplicationItem, ApplicationPayload } from "@/api/types";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import { emptyApplication } from "../payload";
import { CoverLetter } from "./CoverLetter";

const application: ApplicationItem = {
  id: "vacancy-1",
  revision: 2,
  created_at: "2026-10-01T00:00:00Z",
  data: {
    ...emptyApplication,
    name: "Backend developer",
    company_name: "Atlas",
    cover_letter: "",
  },
  next_step: "",
  next_step_key: "",
  resume_title: "",
  interviews: [],
  plans: [],
};

describe("CoverLetter", () => {
  it("shows what the draft relies on and saves only the edited letter", async () => {
    const user = userEvent.setup();
    let saved: ApplicationPayload | null = null;
    server.use(
      http.post(
        "*/api/applications/vacancy-1/cover-letter",
        async ({ request }) => {
          expect(await request.json()).toEqual({ language: "en" });
          return HttpResponse.json({
            text: "Dear Atlas team, I build Python APIs.",
            facts_used: ["Python", "API design"],
            matched_skills: ["Python"],
            missing_skills: ["Kubernetes"],
            provider: "local",
            resume_id: null,
          });
        },
      ),
      http.put("*/api/applications/vacancy-1", async ({ request }) => {
        saved = (await request.json()) as ApplicationPayload;
        return HttpResponse.json({ id: "vacancy-1", revision: 3 });
      }),
      http.get("*/api/*", () => HttpResponse.json([])),
    );
    renderWithProviders(<CoverLetter application={application} />);

    await user.click(
      screen.getByRole("button", { name: "Draft a cover letter" }),
    );
    const letter = await screen.findByRole("textbox", { name: "Cover letter" });
    expect(letter).toHaveValue("Dear Atlas team, I build Python APIs.");
    expect(screen.getByText(/rule-based template/)).toBeInTheDocument();
    expect(screen.getByText(/Python · API design/)).toBeInTheDocument();
    expect(screen.getByText(/Kubernetes/)).toBeInTheDocument();

    await user.clear(letter);
    await user.type(letter, "My own words");
    await user.click(screen.getByRole("button", { name: "Save letter" }));
    expect(await screen.findByText("Cover letter saved.")).toBeInTheDocument();
    expect(saved).toMatchObject({ cover_letter: "My own words", revision: 2 });
  });

  it("explains a refusal instead of inventing a letter", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("*/api/applications/vacancy-1/cover-letter", () =>
        HttpResponse.json(
          { detail: "No facts", code: "letter_needs_facts" },
          { status: 422 },
        ),
      ),
    );
    renderWithProviders(<CoverLetter application={application} />);
    await user.click(
      screen.getByRole("button", { name: "Draft a cover letter" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Fill in your profile or choose a resume",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
