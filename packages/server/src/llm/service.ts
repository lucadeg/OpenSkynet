import type { LLMResponse, ToolDefinition } from "../core/types";

export type Message = Record<string, any>;

export abstract class LLMService {
  abstract chat(
    messages: Message[],
    tools?: ToolDefinition[],
    system?: string,
  ): Promise<LLMResponse>;

  abstract stream(
    messages: Message[],
    tools?: ToolDefinition[],
    system?: string,
  ): AsyncGenerator<string>;

  abstract supportsToolCalling(): boolean;
  abstract supportsStreaming(): boolean;
  abstract getModelInfo(): Record<string, unknown>;
  abstract countTokens(text: string): number;
}

export abstract class LLMPool {
  abstract acquire(type?: string): Promise<LLMService>;
  abstract release(service: LLMService): Promise<void>;
  abstract getPoolStats(): Record<string, unknown>;
}

export abstract class LLMCache {
  abstract get(key: string): Promise<LLMResponse | null>;
  abstract set(key: string, value: LLMResponse, ttl?: number): Promise<void>;
  abstract invalidate(pattern: string): Promise<number>;
  abstract clear(): Promise<void>;
}

export abstract class LLMMetrics {
  abstract recordTokens(model: string, prompt: number, completion: number): void;
  abstract recordRequest(
    model: string,
    durationMs: number,
    success: boolean,
    error?: string,
  ): void;
  abstract getTotalTokens(): number;
  abstract getModelStats(model: string): Record<string, unknown>;
  abstract getCostEstimate(): number;
}
