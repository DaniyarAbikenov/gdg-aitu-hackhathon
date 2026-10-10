import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { InterviewReport } from "@/api/types";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import { InterviewReports } from "./InterviewReports";

const published: InterviewReport = {
  id: "r1",
  company_name: "Example Pay",
  role: "Backend developer",
  interviewed_on: "2026-09",
  stages: "Recruiter call, live coding",
  questions: ["How does an index work?"],
  difficulty: 4,
  outcome: "offer",
  advice: "Practise SQL.",
  status: "approved",
  mine: false,
};

describe("InterviewReports", () => {
  it("lists published reports and sends a new one for moderation", async () => {
    const user = userEvent.setup();
    let sent: Record<string, unknown> | null = null;
    let reports = [published];
    server.use(
      http.get("*/api/companies/c1/reports", () => HttpResponse.json(reports)),
      http.post("*/api/companies/c1/reports", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        const mine: InterviewReport = {
          ...published,
          ...sent,
          id: "r2",
          status: "pending" as const,
          mine: true,
          moderation_note: "",
        };
        reports = [mine, published];
        return HttpResponse.json(mine, { status: 201 });
      }),
    );
    renderWithProviders(<InterviewReports companyId="c1" />);
    expect(
      await screen.findByText("How does an index work?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Difficulty 4/5")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Share your interview" }),
    );
    const form = screen.getByRole("form", {
      name: "Share an interview report",
    });
    expect(within(form).getByText(/Reports are anonymous/)).toBeInTheDocument();
    await user.type(within(form).getByLabelText("Role"), "QA engineer");
    await user.type(
      within(form).getByLabelText("Questions"),
      "Test plan for a login form{enter}{enter}Bug report example",
    );
    await user.selectOptions(
      within(form).getByLabelText("Outcome"),
      "rejected",
    );
    await user.click(
      within(form).getByRole("button", { name: "Send for moderation" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /after moderation/,
    );
    expect(sent).toMatchObject({
      role: "QA engineer",
      questions: ["Test plan for a login form", "Bug report example"],
      outcome: "rejected",
      difficulty: 3,
    });
    expect(
      await screen.findByText("Waiting for moderation"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
  });

  it("explains why a report with contact details was refused", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/companies/c1/reports", () => HttpResponse.json([])),
      http.post("*/api/companies/c1/reports", () =>
        HttpResponse.json(
          { code: "report_private", detail: "private" },
          { status: 422 },
        ),
      ),
    );
    renderWithProviders(<InterviewReports companyId="c1" />);
    expect(
      await screen.findByText(/No published reports yet/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Share your interview" }),
    );
    await user.type(screen.getByLabelText("Role"), "Analyst");
    await user.type(screen.getByLabelText("Advice"), "Write to me");
    await user.click(
      screen.getByRole("button", { name: "Send for moderation" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Remove contact details and links",
    );
  });
});
