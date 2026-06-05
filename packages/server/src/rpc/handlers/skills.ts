import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerSkillHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("skills.list", async () => {
    return { skills: deps.skillEngine.listSkills() };
  });

  server.register("skills.list_all", async () => {
    return { skills: deps.skillEngine.listSkills() };
  });

  server.register("skills.get", async (params) => {
    const name = params.name as string;
    const skill = deps.skillEngine.getSkill(name);
    if (!skill) return { error: `Skill "${name}" not found` };
    return { skill };
  });

  server.register("skills.create", async (params) => {
    const name = params.name as string;
    const description = params.description as string;
    const steps = params.steps as string[];
    const extra: Record<string, unknown> = {};
    if (params.category) extra.category = params.category;
    if (params.variables) extra.variables = params.variables;
    if (params.when_to_use) extra.when_to_use = params.when_to_use;
    const skill = deps.skillEngine.create(name, description, steps, extra);
    return { skill };
  });

  server.register("skills.delete", async (params) => {
    const name = params.name as string;
    const deleted = deps.skillEngine.delete(name);
    return { deleted };
  });

  server.register("skills.run", async (params) => {
    const name = params.name as string;
    const skill = deps.skillEngine.getSkill(name);
    if (!skill) return { error: `Skill "${name}" not found` };
    deps.skillEngine.recordUsage(name);
    const result = await deps.agentLoop.run(
      (skill.description as string) ?? name,
    );
    return { result };
  });

  server.register("skills.search", async (params) => {
    const query = params.query as string;
    const scope = (params.scope as "internal" | "hub" | "all") ?? "all";
    const limit = (params.limit as number) ?? 10;
    const results = await deps.skillSearch.search(query, scope, limit);
    return { results };
  });
}
