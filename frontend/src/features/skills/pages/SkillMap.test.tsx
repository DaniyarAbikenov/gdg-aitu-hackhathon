import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SkillMap as SkillMapData, SkillNode } from "@/api/types";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import SkillMap from "./SkillMap";

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

function node(key: string, name: string, extra: Partial<SkillNode>): SkillNode {
  return {
    key,
    name,
    status: "have",
    in_profile: false,
    demand: 0,
    vacancies: [],
    learning: null,
    practice: [],
    ...extra,
  };
}

const map: SkillMapData = {
  vacancies: 2,
  nodes: [
    node("python", "Python", {
      status: "strength",
      in_profile: true,
      demand: 2,
      practice: [
        {
          interview_id: "i1",
          at: "2026-10-01T10:00:00Z",
          score: 40,
          answers: 1,
        },
        {
          interview_id: "i2",
          at: "2026-10-08T10:00:00Z",
          score: 75,
          answers: 2,
        },
      ],
    }),
    node("docker", "Docker", {
      status: "gap",
      demand: 2,
      vacancies: [{ id: "v1", name: "Backend", company: "Atlas" }],
    }),
    node("git", "Git", { in_profile: true }),
  ],
  links: [{ source: "docker", target: "python", weight: 2 }],
  scores: [
    { interview_id: "i1", at: "2026-10-01T10:00:00Z", score: 40, label: "" },
    { interview_id: "i2", at: "2026-10-08T10:00:00Z", score: 70, label: "" },
  ],
  strongest: "python",
  next_to_learn: ["docker"],
};

describe("SkillMap", () => {
  it("explains a gap and adds a known skill to the profile", async () => {
    const user = userEvent.setup();
    let saved: { profile: { skills: string[] } } | null = null;
    server.use(
      http.get("*/api/skills/map", () => HttpResponse.json(map)),
      http.get("*/api/user/profile", () =>
        HttpResponse.json({
          revision: 3,
          data: { skills: ["Python", "Git"] },
        }),
      ),
      http.post("*/api/user/profile/update", async ({ request }) => {
        saved = (await request.json()) as typeof saved;
        return HttpResponse.json({ revision: 4, data: saved!.profile });
      }),
    );
    renderWithProviders(<SkillMap />);

    expect(
      await screen.findByText(/is in your profile and asked for in 2 of 2/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Docker · 2" }));
    const details = screen.getByRole("region", { name: "Docker" });
    expect(
      within(details).getByText(
        "Asked for in 2 of 2 saved vacancies and not in your profile yet.",
      ),
    ).toBeVisible();
    expect(
      within(details).getByRole("link", { name: "Backend · Atlas" }),
    ).toHaveAttribute("href", "/applications?id=v1");
    expect(
      within(details).getByRole("link", { name: "Create a learning plan" }),
    ).toHaveAttribute("href", "/plan?focus=Docker");

    await user.click(
      within(details).getByRole("button", {
        name: "I know it: add to profile",
      }),
    );
    await vi.waitFor(() =>
      expect(saved?.profile.skills).toEqual(["Python", "Git", "Docker"]),
    );
  });

  it("selects skills from the graph by keyboard and shows their scores", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/skills/map", () => HttpResponse.json(map)),
      http.get("*/api/user/profile", () =>
        HttpResponse.json({ revision: 1, data: { skills: ["Python"] } }),
      ),
    );
    renderWithProviders(<SkillMap />);

    const python = await screen.findByRole("button", {
      name: /^Python\. Matches demand/,
    });
    python.focus();
    await user.keyboard("{Enter}");
    expect(python).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(
        "Latest practice score: 75. Sessions with this skill: 2.",
      ),
    ).toBeVisible();
    const scores = screen.getByRole("table", {
      name: "Practice scores over time",
    });
    expect(within(scores).getAllByRole("row")).toHaveLength(3);
    expect(
      within(scores)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["40", "40", "70", "75"]);

    await user.click(screen.getByRole("tab", { name: "List" }));
    const rows = within(
      screen.getByRole("table", { name: "Skill map" }),
    ).getAllByRole("row");
    expect(rows.map((r) => r.querySelector("th")?.textContent)).toEqual([
      "Skill",
      "Python",
      "Docker",
      "Git",
    ]);
  });
});
