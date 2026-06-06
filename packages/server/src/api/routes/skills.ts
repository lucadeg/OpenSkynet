import { Hono } from "hono";
import type { ApiDeps } from "../app";
import { executeSkill } from "../../skills/executor";

export function createSkillRoutes(deps: ApiDeps): Hono {
  const router = new Hono();

  router.get("/", (c) => {
    const rawSkills = deps.skillEngine.listSkills();

    // Normalize skills to match frontend expectations
    const skills = rawSkills.map((skill: any) => ({
      id: skill.name,
      name: skill.name,
      description: skill.description,
      version: skill.version?.toString() || "1.0.0",
      author: skill.source || "OpenSkynet",
      installed: skill.scope !== "external",
      tags: skill.tags || skill.keywords || [],
      category: skill.category || "general",
      source: skill.source,
      path: skill.path,
      scope: skill.scope,
    }));

    return c.json({ skills });
  });

  router.get("/:name", (c) => {
    const name = c.req.param("name");
    const skill = deps.skillEngine.getSkill(name);
    if (!skill) {
      return c.json({ error: "NOT_FOUND", message: `skill '${name}' not found` }, 404);
    }
    return c.json(skill);
  });

  router.post("/:name/run", async (c) => {
    const name = c.req.param("name");
    const skill = deps.skillEngine.getSkill(name);
    if (!skill) {
      return c.json({ error: "NOT_FOUND", message: `skill '${name}' not found` }, 404);
    }
    const result = await executeSkill(skill, deps.browserSession, deps.llmProvider);
    return c.json({ result });
  });

  router.delete("/:name", (c) => {
    const name = c.req.param("name");
    const ok = deps.skillEngine.delete(name);
    return c.json({ ok });
  });

  router.post("/record/start", async (c) => {
    const body = await c.req.json<{ name?: string }>();
    const result = deps.recordingManager.startRecording(body.name ?? "unnamed");
    return c.json(result);
  });

  router.post("/record/:sessionId/stop", (c) => {
    const sessionId = c.req.param("sessionId");
    const result = deps.recordingManager.stopRecording(sessionId);
    return c.json(result);
  });

  router.get("/record/active", (c) => {
    const sessions = deps.recordingManager.getActiveSessions();
    return c.json({ sessions });
  });

  return router;
}
