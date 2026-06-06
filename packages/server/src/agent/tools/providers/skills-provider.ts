import type { ToolDefinition } from "../../../core/types.js";
import type { ToolResult } from "../interfaces.js";
import type { ToolBus } from "../bus.js";

export class SkillsProvider {
  private skillEngine: unknown;

  constructor(skillEngine?: unknown) {
    this.skillEngine = skillEngine;
  }

  register(bus: ToolBus): void {
    const tools: Array<{ definition: ToolDefinition; executor: (name: string, args: Record<string, unknown>) => Promise<ToolResult> }> = [
      {
        definition: {
          name: "skill_list",
          description: "List all available skills",
          parameters: { type: "object", properties: {}, required: [] },
          toolset: "skills",
        },
        executor: async () => {
          if (!this.skillEngine || typeof (this.skillEngine as Record<string, unknown>).list !== "function") {
            return { success: true, output: "[]" };
          }
          try {
            const skills = await ((this.skillEngine as Record<string, unknown>).list as () => Promise<unknown>)();
            return { success: true, output: JSON.stringify(skills, null, 2) };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "skill_run",
          description: "Run a skill by name",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Skill name" },
              args: { type: "object", description: "Arguments for the skill" },
            },
            required: ["name"],
          },
          toolset: "skills",
        },
        executor: async (_name, args) => {
          if (!this.skillEngine || typeof (this.skillEngine as Record<string, unknown>).run !== "function") {
            return { success: false, output: "", error: "Skill engine not available" };
          }
          try {
            const result = await ((this.skillEngine as Record<string, unknown>).run as (n: string, a: Record<string, unknown>) => Promise<unknown>)(args.name as string, (args.args as Record<string, unknown>) ?? {});
            return { success: true, output: JSON.stringify(result, null, 2) };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "skill_create",
          description: "Create a new skill",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Skill name" },
              description: { type: "string", description: "Skill description" },
              steps: { type: "array", description: "Skill steps", items: { type: "string" } },
            },
            required: ["name", "description", "steps"],
          },
          toolset: "skills",
        },
        executor: async (_name, args) => {
          if (!this.skillEngine || typeof (this.skillEngine as Record<string, unknown>).create !== "function") {
            return { success: false, output: "", error: "Skill engine not available" };
          }
          try {
            const result = await ((this.skillEngine as Record<string, unknown>).create as (a: Record<string, unknown>) => Promise<unknown>)(args as Record<string, unknown>);
            return { success: true, output: JSON.stringify(result, null, 2) };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "skill_delete",
          description: "Delete a skill by name",
          parameters: {
            type: "object",
            properties: { name: { type: "string", description: "Skill name" } },
            required: ["name"],
          },
          toolset: "skills",
        },
        executor: async (_name, args) => {
          if (!this.skillEngine || typeof (this.skillEngine as Record<string, unknown>).delete !== "function") {
            return { success: false, output: "", error: "Skill engine not available" };
          }
          try {
            await ((this.skillEngine as Record<string, unknown>).delete as (n: string) => Promise<void>)(args.name as string);
            return { success: true, output: `Deleted skill: ${args.name}` };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "skill_search",
          description: "Search skills by query",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              limit: { type: "number", description: "Max results (default 10)" },
            },
            required: ["query"],
          },
          toolset: "skills",
        },
        executor: async (_name, args) => {
          if (!this.skillEngine || typeof (this.skillEngine as Record<string, unknown>).search !== "function") {
            return { success: true, output: "[]" };
          }
          try {
            const results = await ((this.skillEngine as Record<string, unknown>).search as (q: string, l: number) => Promise<unknown>)(args.query as string, (args.limit as number) ?? 10);
            return { success: true, output: JSON.stringify(results, null, 2) };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
    ];

    for (const t of tools) {
      bus.register(t.definition, t.executor);
    }
  }
}
