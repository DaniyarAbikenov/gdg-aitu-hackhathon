import { describe, expect, it } from "vitest";
import { errorMessage } from "./client";

describe("errorMessage", () => {
  it("translates a known backend code", () => {
    expect(errorMessage("letter_needs_facts")).toBe(
      "Fill in your profile or choose a resume for this vacancy first.",
    );
    expect(errorMessage("reset_link_invalid", 422)).toContain(
      "Request a new one",
    );
  });

  it("falls back to the HTTP status, then to a network message", () => {
    expect(errorMessage("something_new", 429)).toBe(
      errorMessage("rate_limited"),
    );
    expect(errorMessage(undefined)).toBe(errorMessage(undefined, 599));
  });
});
