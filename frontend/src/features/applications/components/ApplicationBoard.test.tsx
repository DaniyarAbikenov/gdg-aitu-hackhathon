import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationItem, ApplicationPayload } from "@/api/types";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import { emptyApplication } from "../payload";
import { ApplicationBoard } from "./ApplicationBoard";

const stages = {
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview scheduled",
  offer: "Offer received",
  rejected: "Rejected",
  archived: "Archived",
};

function item(id: string, name: string, status: string): ApplicationItem {
  return {
    id,
    revision: 1,
    created_at: "2026-10-01T00:00:00Z",
    data: {
      ...emptyApplication,
      name,
      company_name: "Atlas",
      status,
    } as ApplicationItem["data"],
    next_step: "",
    next_step_key: "",
    resume_title: "",
    interviews: [],
    plans: [],
  };
}

describe("ApplicationBoard", () => {
  it("groups vacancies by stage and hides an empty archive", () => {
    renderWithProviders(
      <ApplicationBoard
        records={[
          item("a", "Backend", "saved"),
          item("b", "Frontend", "applied"),
        ]}
        stages={stages}
        onOpen={() => {}}
      />,
    );
    expect(
      within(screen.getByRole("region", { name: "Saved" })).getByText(
        "Backend",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Applied" })).getByText(
        "Frontend",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Archived" }),
    ).not.toBeInTheDocument();
  });

  it("moves a card with the stage selector and opens it on click", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    let saved: ApplicationPayload | null = null;
    server.use(
      http.put("*/api/applications/a", async ({ request }) => {
        saved = (await request.json()) as ApplicationPayload;
        return HttpResponse.json({ id: "a", revision: 2 });
      }),
      http.get("*/api/*", () => HttpResponse.json([])),
    );
    renderWithProviders(
      <ApplicationBoard
        records={[item("a", "Backend", "saved")]}
        stages={stages}
        onOpen={onOpen}
      />,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Move Backend to stage" }),
      "interview",
    );
    await vi.waitFor(() =>
      expect(saved).toMatchObject({ status: "interview", revision: 1 }),
    );
    expect(saved).not.toHaveProperty("cover_letter");

    await user.click(screen.getByRole("button", { name: /Backend/ }));
    expect(onOpen).toHaveBeenCalledWith("a");
  });
});
