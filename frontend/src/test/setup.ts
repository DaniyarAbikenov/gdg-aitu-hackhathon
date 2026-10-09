import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import i18n from "@/i18n/config";
import { server } from "./server";

beforeAll(async () => {
  // Any request without a handler fails the test instead of reaching the network.
  server.listen({ onUnhandledRequest: "error" });
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
