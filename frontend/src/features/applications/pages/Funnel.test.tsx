import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Funnel as FunnelData } from "@/api/types";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import Funnel from "./Funnel";

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

const weeks = Array.from({ length: 8 }, (_, i) => ({
  week: new Date(Date.UTC(2026, 7, 17 + 7 * i)).toISOString(),
  applications: i === 7 ? 2 : 0,
  practice: i === 7 ? 1 : 0,
  modules: 0,
  reviews: 0,
}));

const funnel: FunnelData = {
  total: 5,
  active: 3,
  stages: [
    { stage: "saved", count: 5, rate: null },
    { stage: "applied", count: 4, rate: 0.8 },
    { stage: "interview", count: 2, rate: 0.5 },
    { stage: "offer", count: 0, rate: 0 },
  ],
  rejections: {
    total: 3,
    reviewed: 2,
    by_stage: [
      { stage: "applied", count: 2 },
      { stage: "interview", count: 1 },
    ],
    by_reason: [{ reason: "no_reply", count: 2 }],
  },
  effort: weeks,
  insights: [
    {
      key: "thisWeek",
      params: { applications: 2, practice: 1, modules: 0 },
    },
    { key: "pattern", params: { reason: "no_reply", count: 2, total: 2 } },
  ],
};

describe("Funnel", () => {
  it("shows stages, rejections and effort-based feedback", async () => {
    server.use(
      http.get("*/api/applications/funnel", ({ request }) => {
        expect(new URL(request.url).searchParams.has("offset")).toBe(true);
        return HttpResponse.json(funnel);
      }),
    );
    renderWithProviders(<Funnel />);

    expect(await screen.findByText("Applied: 4")).toBeVisible();
    expect(screen.getByText("80% of the previous stage")).toBeVisible();
    expect(
      screen.getByText(
        "This week: applications 2, practice interviews 1, learning modules 0. Keep the rhythm.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        /2 of 2 reviewed rejections had the same reason: No reply after applying/,
      ),
    ).toBeVisible();
    expect(screen.getByText("After applying: 2")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Not reviewed yet: 1" }),
    ).toHaveAttribute("href", "/applications");
    expect(screen.getAllByRole("row")).toHaveLength(9);
  });

  it("explains how to start when nothing is saved", async () => {
    server.use(
      http.get("*/api/applications/funnel", () =>
        HttpResponse.json({ ...funnel, total: 0, insights: [] }),
      ),
    );
    renderWithProviders(<Funnel />);
    expect(
      await screen.findByRole("link", { name: "Go to applications" }),
    ).toBeVisible();
  });
});
