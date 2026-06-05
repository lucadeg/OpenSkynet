import { Hono } from "hono";
import { getRecentSessions } from "../../memory/sessions";
import type { ApiDeps } from "../app";

export function createSessionRoutes(deps: ApiDeps): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const sessions = await getRecentSessions(limit);
    return c.json({ sessions });
  });

  return router;
}
