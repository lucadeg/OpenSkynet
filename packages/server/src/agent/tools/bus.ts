import type { ToolDefinition } from "../../core/types.js";
import type { ToolResult, ToolExecutor } from "./interfaces.js";

export class ToolBus {
  private tools = new Map<string, { definition: ToolDefinition; executor: ToolExecutor }>();

  register(definition: ToolDefinition, executor: ToolExecutor): void {
    this.tools.set(definition.name, { definition, executor });
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  getDefinitionsByToolset(toolset: string): ToolDefinition[] {
    return this.getDefinitions().filter((d) => d.toolset === toolset);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const entry = this.tools.get(name);
    if (!entry) {
      return { success: false, output: "", error: `Unknown tool: ${name}` };
    }
    return entry.executor(name, args);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  clear(): void {
    this.tools.clear();
  }
}
