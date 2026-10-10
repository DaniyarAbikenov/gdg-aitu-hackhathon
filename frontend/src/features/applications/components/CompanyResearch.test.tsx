import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import type { CompanyRecord } from "../types";
import { CompanyResearch } from "./CompanyResearch";

const company: CompanyRecord = {
  id: "company-1",
  revision: 2,
  data: {
    name: "Example Pay",
    description: "",
    website: "https://example.test/",
    location: "",
    skills: [],
    hiring_process: "",
    notes: "",
    assignments: [],
    archived: false,
  },
};

const research = {
  fetched_at: "2026-10-10T08:00:00Z",
  provider: "openai",
  sources: ["https://example.test", "https://example.test/careers"],
  facts: [
    {
      topic: "hiring",
      text: "Three interview stages",
      quote: "a short call, a take-home task and a team interview",
      source_url: "https://example.test/careers",
    },
  ],
  stack: [{ name: "Python", source_url: "https://example.test" }],
  dropped: 1,
};

describe("CompanyResearch", () => {
  it("reads the website and shows each fact with its quote and page", async () => {
    const user = userEvent.setup();
    let sent: unknown = null;
    server.use(
      http.post("*/api/companies/company-1/research", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          id: "company-1",
          revision: 3,
          created_at: "2026-10-01T00:00:00Z",
          data: { ...company.data, research },
          research,
        });
      }),
    );
    renderWithProviders(<CompanyResearch company={company} />);
    await user.click(screen.getByRole("button", { name: "Read the website" }));
    expect(sent).toMatchObject({ revision: 2 });

    // The page shows saved research from the company record.
    renderWithProviders(
      <CompanyResearch
        company={{ ...company, data: { ...company.data, research } }}
      />,
    );
    expect(screen.getByText("Three interview stages")).toBeInTheDocument();
    expect(
      screen.getByText("«a short call, a take-home task and a team interview»"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /example\.test\/careers/ })[0],
    ).toHaveAttribute("href", "https://example.test/careers");
    expect(screen.getByText(/every fact was checked/)).toBeInTheDocument();
    expect(
      screen.getByText(/did not contain their quote: 1/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Python" })).toBeInTheDocument();
  });

  it("labels offline reading as rule-based and asks for a website when there is none", () => {
    renderWithProviders(
      <CompanyResearch
        company={{
          ...company,
          data: {
            ...company.data,
            research: { ...research, provider: "rule-based", dropped: 0 },
          },
        }}
      />,
    );
    expect(screen.getByText(/Rule-based reading/)).toBeInTheDocument();
    renderWithProviders(
      <CompanyResearch
        company={{ ...company, data: { ...company.data, website: null } }}
      />,
    );
    expect(screen.getByText(/Add the company website/)).toBeInTheDocument();
  });
});
