import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import ResetPassword from "./ResetPassword";

const TOKEN = "a".repeat(43);

describe("ResetPassword", () => {
  beforeEach(() =>
    window.history.replaceState(null, "", `/reset-password#token=${TOKEN}`),
  );

  it("takes the token out of the address bar and sets the new password", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post("*/api/auth/password/reset", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<ResetPassword />);
    expect(window.location.hash).toBe("");

    await user.type(
      screen.getByLabelText("New password"),
      "Recovered-password-42",
    );
    await user.type(
      screen.getByLabelText("Repeat the new password"),
      "Recovered-password-42",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));
    expect(
      await screen.findByText(/every device was signed out/),
    ).toBeInTheDocument();
    expect(body).toEqual({ token: TOKEN, password: "Recovered-password-42" });
  });

  it("does not send mismatched passwords", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPassword />);
    await user.type(
      screen.getByLabelText("New password"),
      "Recovered-password-42",
    );
    await user.type(
      screen.getByLabelText("Repeat the new password"),
      "Recovered-password-43",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
  });

  it("explains an expired link", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("*/api/auth/password/reset", () =>
        HttpResponse.json(
          { detail: "expired", code: "reset_link_invalid" },
          { status: 422 },
        ),
      ),
    );
    renderWithProviders(<ResetPassword />);
    await user.type(
      screen.getByLabelText("New password"),
      "Recovered-password-42",
    );
    await user.type(
      screen.getByLabelText("Repeat the new password"),
      "Recovered-password-42",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Request a new one",
    );
  });

  it("asks for the emailed link when opened without a token", () => {
    window.history.replaceState(null, "", "/reset-password");
    renderWithProviders(<ResetPassword />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "needs the link from the email",
    );
  });
});
