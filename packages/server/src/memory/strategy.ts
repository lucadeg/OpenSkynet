import type { MemoryEntry } from "../core/types";

export abstract class BaseMemoryStrategy {
  static name(): string {
    return "base";
  }

  abstract initialize(): Promise<void>;
  abstract write(
    target: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): boolean;
  abstract search(query: string, limit?: number): MemoryEntry[];
  abstract replace(
    target: string,
    oldContent: string,
    newContent: string,
  ): boolean;
  abstract remove(target: string, content: string): boolean;
  abstract context(task: string, maxChars?: number): string;

  async review(
    _conversation: Array<{ role: string; content: string }>,
  ): Promise<Array<Record<string, unknown>>> {
    return [];
  }

  async onTurnStart(): Promise<void> {}

  async onSessionEnd(): Promise<void> {}

  async onPreCompress(): Promise<void> {}

  shouldReview(_turnCount: number): boolean {
    return false;
  }

  getToolSchema(): Record<string, unknown> | null {
    return null;
  }

  getToolSchemas(): Array<Record<string, unknown>> {
    const s = this.getToolSchema();
    return s ? [s] : [];
  }

  async handleToolCall(
    toolName: string,
    _args: Record<string, unknown>,
  ): Promise<string> {
    return `Tool ${toolName} not implemented`;
  }

  get version(): string {
    return "1.0.0";
  }
}
