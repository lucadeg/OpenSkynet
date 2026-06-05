import { Hono } from "hono";
import { HubClient } from "../../skills/hub";
import type { ApiDeps } from "../app";

export function createHubRoutes(deps: ApiDeps): Hono {
  const router = new Hono();
  const hub = new HubClient();

  router.get("/browse", async (c) => {
    const category = c.req.query("category");
    const skills = await hub.browse(category);
    return c.json({ skills });
  });

  router.get("/search", async (c) => {
    const q = c.req.query("q");
    if (!q) {
      return c.json({ error: "VALIDATION_ERROR", message: "q is required" }, 400);
    }
    const skills = await hub.search(q);
    return c.json({ skills });
  });

  router.get("/:name", async (c) => {
    const name = c.req.param("name");
    const info = await hub.info(name);
    return c.json(info);
  });

  router.post("/install", async (c) => {
    const body = await c.req.json<{ name: string }>();
    if (!body.name) {
      return c.json({ error: "VALIDATION_ERROR", message: "name is required" }, 400);
    }
    const result = await hub.install(body.name, deps.skillEngine);
    return c.json(result);
  });

  return router;
}
