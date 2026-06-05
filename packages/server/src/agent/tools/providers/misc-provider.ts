import type { ToolDefinition } from "../../../core/types.js";
import type { ToolResult } from "../interfaces.js";
import type { ToolBus } from "../bus.js";

export class MiscProvider {
  private memoryManager: unknown;

  constructor(memoryManager?: unknown) {
    this.memoryManager = memoryManager;
  }

  register(bus: ToolBus): void {
    const tools: Array<{ definition: ToolDefinition; executor: (name: string, args: Record<string, unknown>) => Promise<ToolResult> }> = [
      {
        definition: {
          name: "memory_add",
          description: "Store a memory entry",
          parameters: {
            type: "object",
            properties: {
              content: { type: "string", description: "Memory content" },
              target: { type: "string", description: "Target: memory or user" },
              type: { type: "string", description: "Type: fact, procedure, episodic, preference" },
            },
            required: ["content"],
          },
          toolset: "misc",
        },
        executor: async (_name, args) => {
          if (!this.memoryManager || typeof (this.memoryManager as Record<string, unknown>).add !== "function") {
            return { success: true, output: "Memory stored (no-op)" };
          }
          try {
            const result = await ((this.memoryManager as Record<string, unknown>).add as (a: Record<string, unknown>) => Promise<unknown>)(args);
            return { success: true, output: JSON.stringify(result, null, 2) };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "memory_search",
          description: "Search stored memories",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              limit: { type: "number", description: "Max results (default 5)" },
            },
            required: ["query"],
          },
          toolset: "misc",
        },
        executor: async (_name, args) => {
          if (!this.memoryManager || typeof (this.memoryManager as Record<string, unknown>).search !== "function") {
            return { success: true, output: "[]" };
          }
          try {
            const results = await ((this.memoryManager as Record<string, unknown>).search as (q: string, l: number) => Promise<unknown>)(args.query as string, (args.limit as number) ?? 5);
            return { success: true, output: JSON.stringify(results, null, 2) };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "todo_read",
          description: "Read the current todo list",
          parameters: { type: "object", properties: {}, required: [] },
          toolset: "misc",
        },
        executor: async () => {
          if (!this.memoryManager || typeof (this.memoryManager as Record<string, unknown>).getTodos !== "function") {
            return { success: true, output: "[]" };
          }
          try {
            const todos = await ((this.memoryManager as Record<string, unknown>).getTodos as () => Promise<unknown>)();
            return { success: true, output: JSON.stringify(todos, null, 2) };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "todo_write",
          description: "Write or update the todo list",
          parameters: {
            type: "object",
            properties: {
              todos: {
                type: "array",
                description: "List of todo items",
                items: { type: "string" },
              },
            },
            required: ["todos"],
          },
          toolset: "misc",
        },
        executor: async (_name, args) => {
          if (!this.memoryManager || typeof (this.memoryManager as Record<string, unknown>).setTodos !== "function") {
            return { success: true, output: "Todos updated (no-op)" };
          }
          try {
            await ((this.memoryManager as Record<string, unknown>).setTodos as (t: string[]) => Promise<void>)(args.todos as string[]);
            return { success: true, output: `Updated ${Array.isArray(args.todos) ? args.todos.length : 0} todos` };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "think",
          description: "Use the think tool to reason about a problem",
          parameters: {
            type: "object",
            properties: {
              thought: { type: "string", description: "Your reasoning or analysis" },
            },
            required: ["thought"],
          },
          toolset: "misc",
        },
        executor: async (_name, args) => {
          return { success: true, output: args.thought as string };
        },
      },
    ];

    for (const t of tools) {
      bus.register(t.definition, t.executor);
    }
  }
}
