import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import ReportModeration from "./ReportModeration";

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

const report = {
  id: "r1",
  company_name: "Example Pay",
  role: "Backend developer",
  interviewed_on: "2026-09",
  stages: "Live coding",
  questions: [],
  difficulty: 3,
  outcome: "rejected",
  advice: "",
  status: "pending",
  mine: false,
};

describe("ReportModeration", () => {
  it("publishes a waiting report with a note", async () => {
    const user = userEvent.setup();
    let queue = [report];
    let decision: unknown = null;
    server.use(
      http.get("*/api/admin/reports", () => HttpResponse.json(queue)),
      http.post("*/api/admin/reports/r1", async ({ request }) => {
        decision = await request.json();
        queue = [];
        return HttpResponse.json({ ...report, status: "approved" });
      }),
    );
    renderWithProviders(<ReportModeration />);
    expect(await screen.findByText("Example Pay")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Note to the author/), "Thanks");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(decision).toEqual({ status: "approved", note: "Thanks" });
    expect(
      await screen.findByText("No reports are waiting."),
    ).toBeInTheDocument();
  });
});
