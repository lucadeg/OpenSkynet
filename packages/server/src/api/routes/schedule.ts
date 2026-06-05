import { Hono } from "hono";
import type { ApiDeps } from "../app";

export function createScheduleRoutes(deps: ApiDeps): Hono {
  const router = new Hono();

  router.get("/", (c) => {
    const jobs = deps.cronManager.listJobs();
    return c.json({ jobs });
  });

  router.post("/", async (c) => {
    const body = await c.req.json<{
      cron: string;
      task: string;
      skill_name?: string;
      provider?: string;
      model?: string;
    }>();
    if (!body.cron || !body.task) {
      return c.json({ error: "VALIDATION_ERROR", message: "cron and task are required" }, 400);
    }
    const jobId = deps.cronManager.addJob(
      body.cron,
      body.task,
      body.skill_name,
      body.provider,
      body.model,
    );
    return c.json({ id: jobId, status: "scheduled" }, 201);
  });

  router.delete("/:jobId", (c) => {
    const jobId = c.req.param("jobId");
    const ok = deps.cronManager.removeJob(jobId);
    return c.json({ ok });
  });

  return router;
}
