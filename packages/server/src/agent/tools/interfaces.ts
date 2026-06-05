export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolProvider {
  register(bus: { register(definition: import("../../core/types.js").ToolDefinition, executor: ToolExecutor): void }): void;
}

export interface ToolExecutor {
  (name: string, args: Record<string, unknown>): Promise<ToolResult>;
}
