import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** API handlers every test starts with; tests add their own with `server.use`. */
export const server = setupServer(
  http.get("*/api/user/me", () =>
    HttpResponse.json({ uid: "", authenticated: false, email: "" }),
  ),
  http.get("*/api/auth/options", () =>
    HttpResponse.json({ postgres: true, google: false, email: true }),
  ),
);
