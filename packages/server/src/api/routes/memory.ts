import { Hono } from "hono";
import {
  getAllEntries,
  addEntry,
  replaceEntry,
  removeEntry,
} from "../../memory/store";
import type { ApiDeps } from "../app";

export function createMemoryRoutes(_deps: ApiDeps): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    const data = await getAllEntries();
    return c.json(data);
  });

  router.post("/add", async (c) => {
    const body = await c.req.json<{
      content: string;
      target?: string;
      type?: string;
      source?: string;
    }>();
    if (!body.content?.trim()) {
      return c.json({ error: "VALIDATION_ERROR", message: "content is required" }, 400);
    }
    const result = await addEntry(
      body.target ?? "memory",
      body.content,
      (body.type as any) ?? "fact",
      body.source,
    );
    return c.json(result, 201);
  });

  router.post("/replace", async (c) => {
    const body = await c.req.json<{
      target: string;
      old_content: string;
      new_content: string;
    }>();
    if (!body.target || !body.old_content || !body.new_content) {
      return c.json({ error: "VALIDATION_ERROR", message: "target, old_content, and new_content are required" }, 400);
    }
    const result = await replaceEntry(body.target, body.old_content, body.new_content);
    return c.json(result);
  });

  router.post("/remove", async (c) => {
    const body = await c.req.json<{
      target: string;
      content: string;
    }>();
    if (!body.target || !body.content) {
      return c.json({ error: "VALIDATION_ERROR", message: "target and content are required" }, 400);
    }
    const result = await removeEntry(body.target, body.content);
    return c.json(result);
  });

  return router;
}
