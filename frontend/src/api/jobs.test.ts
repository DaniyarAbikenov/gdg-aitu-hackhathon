import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { postJob, useActiveJobs } from "./jobs";

/** jsdom has no EventSource; this one replays the statuses a test gives it. */
class FakeEvents {
  static statuses: object[] = [];
  static last: FakeEvents | null = null;
  closed = false;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeEvents.last = this;
  }
  addEventListener(_type: string, listener: (e: MessageEvent) => void) {
    queueMicrotask(() => {
      for (const status of FakeEvents.statuses)
        if (!this.closed)
          listener(
            new MessageEvent("status", { data: JSON.stringify(status) }),
          );
    });
  }
  close() {
    this.closed = true;
  }
}

const queued = { id: "job-1", status: "queued", result: null, error: null };

function accept() {
  server.use(
    http.post("*/api/plan", ({ request }) => {
      expect(request.headers.get("prefer")).toBe("respond-async");
      return HttpResponse.json(queued, { status: 202 });
    }),
  );
}

describe("postJob", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a direct answer when the server does not queue the request", async () => {
    server.use(http.post("*/api/plan", () => HttpResponse.json({ id: "p1" })));
    await expect(postJob("/plan", {})).resolves.toEqual({ id: "p1" });
  });

  it("follows a queued job to its result and clears the indicator", async () => {
    vi.stubGlobal("EventSource", FakeEvents);
    FakeEvents.statuses = [
      { ...queued, status: "running" },
      { ...queued, status: "done", result: { id: "p1" } },
    ];
    accept();
    await expect(postJob("/plan", {})).resolves.toEqual({ id: "p1" });
    expect(FakeEvents.last?.url).toBe("/api/jobs/job-1/events");
    expect(FakeEvents.last?.closed).toBe(true);
    expect(useActiveJobs.getState().jobs).toEqual({});
  });

  it("rejects with the translated error of a failed job", async () => {
    vi.stubGlobal("EventSource", FakeEvents);
    FakeEvents.statuses = [
      {
        ...queued,
        status: "failed",
        error: { code: "rate_limited", detail: "" },
      },
    ];
    accept();
    await expect(postJob("/plan", {})).rejects.toThrow("Too many requests");
    expect(useActiveJobs.getState().jobs).toEqual({});
  });
});
