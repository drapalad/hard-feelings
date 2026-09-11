import { describe, expect, it, vi } from "vitest";
import { GET as planGet, POST as planPost } from "./plan";
import { PATCH as unitsPatch, PUT as unitsPut, DELETE as unitsDelete } from "./plan/units";
import { POST as stagesFromDescriptionPost } from "./plan/stages-from-description";
import { POST as undoPost } from "./plan/undo";
import { POST as restorePost } from "./plan/restore";
import { POST as snapshotsPost } from "./plan/snapshots";
import { DELETE as logsDelete, POST as logsPost } from "./plan/logs";
import { GET as chatGet } from "./chat";
import { POST as chatMessagesPost } from "./chat/messages";
import { GET as chatThreadsGet, POST as chatThreadsPost } from "./chat/threads";
import { POST as chatAcceptPost } from "./chat/accept";
import { GET as adminSettingsGet, PATCH as adminSettingsPatch } from "./admin/settings";
import { GET as adminReportsGet } from "./admin/reports";
import { DELETE as adminReportDelete, PATCH as adminReportPatch } from "./admin/reports/[id]";

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "anon-key",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
}));

type RouteHandler = typeof planGet;

function loggedOutContext(method: string, path: string): Parameters<RouteHandler>[0] {
  const url = new URL(`http://localhost${path}`);
  return {
    locals: { user: null, isAdmin: false },
    request: new Request(url, { method }),
    url,
  } as Parameters<RouteHandler>[0];
}

const GATES: { name: string; method: string; path: string; handler: RouteHandler }[] = [
  { name: "GET /api/plan", method: "GET", path: "/api/plan", handler: planGet },
  { name: "POST /api/plan", method: "POST", path: "/api/plan", handler: planPost },
  { name: "PATCH /api/plan/units", method: "PATCH", path: "/api/plan/units", handler: unitsPatch },
  { name: "PUT /api/plan/units", method: "PUT", path: "/api/plan/units", handler: unitsPut },
  { name: "DELETE /api/plan/units", method: "DELETE", path: "/api/plan/units", handler: unitsDelete },
  {
    name: "POST /api/plan/stages-from-description",
    method: "POST",
    path: "/api/plan/stages-from-description",
    handler: stagesFromDescriptionPost,
  },
  { name: "POST /api/plan/undo", method: "POST", path: "/api/plan/undo", handler: undoPost },
  { name: "POST /api/plan/restore", method: "POST", path: "/api/plan/restore", handler: restorePost },
  { name: "POST /api/plan/snapshots", method: "POST", path: "/api/plan/snapshots", handler: snapshotsPost },
  { name: "POST /api/plan/logs", method: "POST", path: "/api/plan/logs", handler: logsPost },
  { name: "DELETE /api/plan/logs", method: "DELETE", path: "/api/plan/logs", handler: logsDelete },
  { name: "GET /api/chat", method: "GET", path: "/api/chat", handler: chatGet },
  { name: "POST /api/chat/messages", method: "POST", path: "/api/chat/messages", handler: chatMessagesPost },
  { name: "GET /api/chat/threads", method: "GET", path: "/api/chat/threads", handler: chatThreadsGet },
  { name: "POST /api/chat/threads", method: "POST", path: "/api/chat/threads", handler: chatThreadsPost },
  { name: "POST /api/chat/accept", method: "POST", path: "/api/chat/accept", handler: chatAcceptPost },
  { name: "GET /api/admin/settings", method: "GET", path: "/api/admin/settings", handler: adminSettingsGet },
  { name: "PATCH /api/admin/settings", method: "PATCH", path: "/api/admin/settings", handler: adminSettingsPatch },
  { name: "GET /api/admin/reports", method: "GET", path: "/api/admin/reports", handler: adminReportsGet },
  {
    name: "PATCH /api/admin/reports/:id",
    method: "PATCH",
    path: "/api/admin/reports/report-1",
    handler: adminReportPatch,
  },
  {
    name: "DELETE /api/admin/reports/:id",
    method: "DELETE",
    path: "/api/admin/reports/report-1",
    handler: adminReportDelete,
  },
];

describe("risk #6 logged-out 401: gated product JSON APIs", () => {
  it.each(GATES)("$name returns 401 UNAUTHORIZED JSON and no member payload", async ({ method, path, handler }) => {
    const response = await handler(loggedOutContext(method, path));
    expect(response.status).toBe(401);
    expect(response.headers.get("Location")).toBeNull();
    const body: unknown = await response.json();
    expect(body).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });
    expect(body).not.toHaveProperty("units");
    expect(body).not.toHaveProperty("logs");
    expect(body).not.toHaveProperty("messages");
    expect(body).not.toHaveProperty("threads");
    expect(body).not.toHaveProperty("plan");
  });
});
