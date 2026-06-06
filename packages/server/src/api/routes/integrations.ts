import { Hono } from "hono";
import type { ApiDeps } from "../app";

export function createIntegrationRoutes(deps: ApiDeps): Hono {
  const router = new Hono();

  router.get("/", (c) => {
    const integrations = [
      { name: "whatsapp", configured: false, status: "disconnected" },
      { name: "telegram", configured: false, status: "disconnected" },
      { name: "discord", configured: false, status: "disconnected" },
      { name: "slack", configured: false, status: "disconnected" },
      { name: "lark", configured: false, status: "disconnected" },
      { name: "wechat", configured: false, status: "disconnected" },
    ];
    return c.json({ integrations });
  });

  router.post("/:name/configure", async (c) => {
    const name = c.req.param("name");
    const config = await c.req.json();
    return c.json({ ok: true, name, configured: true });
  });

  router.post("/:name/send", async (c) => {
    const name = c.req.param("name");
    const body = await c.req.json<{ message: string; target?: string }>();
    if (!body.message) {
      return c.json({ error: "VALIDATION_ERROR", message: "message is required" }, 400);
    }
    return c.json({ ok: true, name, sent: true });
  });

  router.get("/:name/status", (c) => {
    const name = c.req.param("name");
    return c.json({ name, status: "disconnected", configured: false });
  });

  router.post("/whatsapp/webhook", async (c) => {
    const body = await c.req.json();
    return c.json({ ok: true });
  });

  router.post("/lark/webhook", async (c) => {
    const body = await c.req.json();
    const challenge = body.challenge;
    if (challenge) {
      return c.json({ challenge });
    }
    return c.json({ ok: true });
  });

  return router;
}
