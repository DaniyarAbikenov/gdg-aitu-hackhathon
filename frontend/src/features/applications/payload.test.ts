import { describe, expect, it } from "vitest";
import { applicationPayload, emptyApplication } from "./payload";

const saved = {
  ...emptyApplication,
  name: "Backend developer",
  company_name: "Atlas",
  description: "Build Python APIs",
  cover_letter: "Dear Atlas team",
  source_url: "",
  follow_up: "2026-10-20",
};

describe("applicationPayload", () => {
  it("never sends the cover letter unless it is the change being made", () => {
    const payload = applicationPayload(saved, 3, { status: "applied" });
    expect(payload).not.toHaveProperty("cover_letter");
    expect(payload.status).toBe("applied");
    expect(payload.revision).toBe(3);
  });

  it("sends an edited cover letter", () => {
    const payload = applicationPayload(saved, 3, { cover_letter: "New text" });
    expect(payload.cover_letter).toBe("New text");
  });

  it("turns empty optional references into nulls", () => {
    const payload = applicationPayload(saved, 0);
    expect(payload.source_url).toBeNull();
    expect(payload.resume_id).toBeNull();
    expect(payload.company_id).toBeNull();
    expect(payload.follow_up).toBe("2026-10-20");
  });

  it("drops server-derived fields that are not editable", () => {
    const payload = applicationPayload(
      { ...saved, next_step: "Prepare" } as typeof saved,
      1,
    );
    expect(payload).not.toHaveProperty("next_step");
  });
});
