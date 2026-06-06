import { Hono } from "hono";
import type { ApiDeps } from "../app";

export function createSandboxRoutes(deps: ApiDeps): Hono {
  const router = new Hono();

  router.post("/start", async (c) => {
    if (deps.browserSession.isStarted) {
      return c.json({ status: "already_running" });
    }
    await deps.browserSession.start();
    return c.json({ status: "started" });
  });

  router.post("/stop", async (c) => {
    await deps.browserSession.stop();
    return c.json({ status: "stopped" });
  });

  router.get("/status", (c) => {
    return c.json({
      started: deps.browserSession.isStarted,
      stealth: deps.browserSession.isStealth,
    });
  });

  router.post("/control", async (c) => {
    const body = await c.req.json<{
      type: string;
      url?: string;
      selector?: string;
      text?: string;
    }>();
    if (!deps.browserSession.isStarted) {
      return c.json({ error: "BROWSER_ERROR", message: "browser not started" }, 400);
    }
    return c.json({ ok: true, type: body.type });
  });

  return router;
}

export function createSystemRoutes(deps: ApiDeps): Hono {
  const router = new Hono();

  router.get("/screenshot", async (c) => {
    if (!deps.browserSession.isStarted) {
      return c.json({ error: "BROWSER_ERROR", message: "browser not started" }, 400);
    }
    const data = await deps.browserSession.takeScreenshot();
    if (!data) {
      return c.json({ error: "BROWSER_ERROR", message: "screenshot failed" }, 500);
    }
    return c.json({ screenshot: data });
  });

  router.get("/status", (c) => {
    return c.json({
      running: true,
      uptime_secs: process.uptime(),
      browser_open: deps.browserSession.isStarted,
      tasks_completed: 0,
    });
  });

  return router;
}
