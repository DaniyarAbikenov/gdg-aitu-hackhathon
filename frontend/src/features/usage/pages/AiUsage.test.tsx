import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import AiUsage from "./AiUsage";

// The page is tested on its own; the app shell has its own data needs.
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

const row = {
  provider: "openai",
  model: "model-a",
  operation: "CoverLetter",
  calls: 2,
  failed: 1,
  input_tokens: 4000,
  output_tokens: 1000,
  average_ms: 900,
  cost_usd: null,
};

describe("AiUsage", () => {
  it("shows totals per task and asks for prices when none are configured", async () => {
    const user = userEvent.setup();
    const periods: string[] = [];
    server.use(
      http.get("*/api/admin/ai-usage", ({ request }) => {
        periods.push(new URL(request.url).searchParams.get("days")!);
        return HttpResponse.json({
          days: 30,
          priced: false,
          totals: {
            calls: 2,
            failed: 1,
            input_tokens: 4000,
            output_tokens: 1000,
            cost_usd: null,
          },
          operations: [row],
          daily: [
            {
              day: "2026-10-09",
              calls: 2,
              input_tokens: 4000,
              output_tokens: 1000,
              cost_usd: null,
            },
          ],
        });
      }),
    );
    renderWithProviders(<AiUsage />);
    const tokens = await screen.findByText("Tokens");
    expect(tokens.nextSibling).toHaveTextContent("5,000");
    expect(
      screen.getByText(/CAREER_AI_INPUT_USD_PER_MILLION/),
    ).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("CoverLetter")).toBeInTheDocument();
    expect(within(table).getByText("2 (1 failed)")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "7");
    await vi.waitFor(() => expect(periods).toEqual(["30", "7"]));
  });

  it("tells a non-administrator the page is unavailable", async () => {
    server.use(
      http.get("*/api/admin/ai-usage", () =>
        HttpResponse.json(
          { detail: "no", code: "admin_only" },
          { status: 403 },
        ),
      ),
    );
    renderWithProviders(<AiUsage />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
