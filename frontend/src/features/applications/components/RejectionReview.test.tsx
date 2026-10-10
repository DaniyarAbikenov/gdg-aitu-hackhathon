import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ApplicationItem } from "@/api/types";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import { emptyApplication } from "../payload";
import { RejectionReview } from "./RejectionReview";

const application: ApplicationItem = {
  id: "vacancy-1",
  revision: 4,
  created_at: "2026-10-01T00:00:00Z",
  data: {
    ...emptyApplication,
    name: "Backend developer",
    company_name: "Atlas",
    status: "rejected",
    cover_letter: "",
    stages: {
      applied: "2026-10-02T00:00:00Z",
      interview: "2026-10-05T00:00:00Z",
    },
  },
  next_step: "",
  next_step_key: "reviewRejection",
  resume_title: "",
  interviews: [],
  plans: [],
};

describe("RejectionReview", () => {
  it("turns three answers into one next step", async () => {
    const user = userEvent.setup();
    let sent: unknown = null;
    server.use(
      http.put(
        "*/api/applications/vacancy-1/rejection",
        async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json({
            revision: 5,
            rejection: {
              ...(sent as object),
              created_at: "2026-10-10T00:00:00Z",
            },
            next_action: { key: "studyTopics", topics: ["SQL joins"] },
          });
        },
      ),
      http.get("*/api/*", () => HttpResponse.json([])),
    );
    const { unmount } = renderWithProviders(
      <RejectionReview application={application} />,
    );

    expect(
      screen.getByRole("radio", { name: "After an interview" }),
    ).toBeChecked();
    const submit = screen.getByRole("button", { name: "Get my next step" });
    expect(submit).toBeDisabled();
    await user.click(
      screen.getByRole("radio", { name: "Technical interview" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Topics that felt weak" }),
      "SQL joins{enter}{enter}",
    );
    await user.click(submit);

    expect(sent).toEqual({
      revision: 4,
      stage: "interview",
      reason: "technical",
      topics: ["SQL joins"],
      feedback: "",
    });

    // The page refetches the application with the saved review and its step.
    unmount();
    renderWithProviders(
      <RejectionReview
        application={{
          ...application,
          revision: 5,
          data: {
            ...application.data,
            rejection: {
              stage: "interview",
              reason: "technical",
              topics: ["SQL joins"],
              feedback: "",
              created_at: "2026-10-10T00:00:00Z",
            },
          },
          rejection_action: { key: "studyTopics", topics: ["SQL joins"] },
        }}
      />,
    );
    expect(
      screen.getByText("Build a learning plan around: SQL joins."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Create the plan" }),
    ).toHaveAttribute("href", "/plan?vacancy=vacancy-1&focus=SQL%20joins");
    expect(screen.getByText(/not a verdict/)).toBeVisible();
  });

  it("does not blame the candidate for reasons outside their control", () => {
    renderWithProviders(
      <RejectionReview
        application={{
          ...application,
          data: {
            ...application.data,
            rejection: {
              stage: "applied",
              reason: "position_closed",
              topics: [],
              feedback: "",
              created_at: "2026-10-10T00:00:00Z",
            },
          },
          rejection_action: { key: "keepGoing", topics: [] },
        }}
      />,
    );
    expect(screen.getByText(/not about your preparation/)).toBeVisible();
    expect(
      screen.getByText(
        "Stopped: After applying. Reason: The position was closed or frozen.",
      ),
    ).toBeVisible();
  });
});
