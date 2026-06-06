import { Hono } from "hono";
import { setKey, listKeys, removeKey } from "../../core/auth";
import { listProvidersWithAuth } from "../../llm/provider";

export function createAuthRoutes(): Hono {
  const router = new Hono();

  router.post("/set", async (c) => {
    const body = await c.req.json<{ provider: string; key: string }>();
    if (!body.provider?.trim()) {
      return c.json(
        { error: "VALIDATION_ERROR", message: "provider is required" },
        400,
      );
    }
    if (!body.key?.trim()) {
      return c.json(
        { error: "VALIDATION_ERROR", message: "key is required" },
        400,
      );
    }
    await setKey(body.provider.trim(), body.key.trim());
    return c.json({ ok: true, provider: body.provider.trim() });
  });

  router.delete("/:provider", async (c) => {
    const provider = c.req.param("provider");
    const ok = await removeKey(provider);
    return c.json({ ok });
  });

  router.get("/status", async (c) => {
    const providers = await listProvidersWithAuth();
    const stored = await listKeys();
    const status: Record<
      string,
      {
        has_key: boolean;
        added_at?: string;
        needs_api_key: boolean;
        default_model: string;
      }
    > = {};

    for (const p of providers) {
      status[p.name] = {
        has_key: p.has_key,
        added_at: stored[p.name]?.added_at,
        needs_api_key: p.needs_api_key,
        default_model: p.default_model,
      };
    }

    return c.json(status);
  });

  return router;
}
