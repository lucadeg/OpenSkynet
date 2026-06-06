import { Hono } from "hono";
import type { ApiDeps } from "../app";

interface TaskEntry {
  id: string;
  task: string;
  status: string;
  result?: unknown;
}

const tasks = new Map<string, TaskEntry>();

export function createTaskRoutes(deps: ApiDeps): Hono {
  const router = new Hono();

  router.post("/", async (c) => {
    const body = await c.req.json<{ task: string }>();
    if (!body.task?.trim()) {
      return c.json({ error: "VALIDATION_ERROR", message: "task is required" }, 400);
    }

    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry: TaskEntry = { id, task: body.task, status: "queued" };
    tasks.set(id, entry);

    (async () => {
      try {
        entry.status = "running";
        const result = await deps.llmProvider.chat(
          [{ role: "user", content: body.task }],
          [],
        );
        entry.status = "completed";
        entry.result = result;
      } catch (err) {
        entry.status = "failed";
        entry.result = err instanceof Error ? err.message : String(err);
      }
    })();

    return c.json({ id, status: "queued" }, 202);
  });

  router.get("/:id", (c) => {
    const id = c.req.param("id");
    const entry = tasks.get(id);
    if (!entry) {
      return c.json({ error: "NOT_FOUND", message: "task not found" }, 404);
    }
    return c.json(entry);
  });

  return router;
}
