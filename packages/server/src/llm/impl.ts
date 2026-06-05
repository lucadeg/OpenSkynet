import type { LLMResponse, ToolDefinition } from "../core/types";
import type { LLMProvider, Message } from "./provider";
import { LLMService, LLMCache } from "./service";
import { estimateTokens } from "./tokens";

export class BasicLLMService extends LLMService {
  private _provider: LLMProvider;
  private _model: string;
  private _supportsTools: boolean;
  private _supportsStreaming: boolean;

  constructor(
    provider: LLMProvider,
    model: string,
    supportsTools = true,
    supportsStreaming = true,
  ) {
    super();
    this._provider = provider;
    this._model = model;
    this._supportsTools = supportsTools;
    this._supportsStreaming = supportsStreaming;
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    system?: string,
  ): Promise<LLMResponse> {
    return this._provider.chat(messages, tools ?? [], system);
  }

  async *stream(
    messages: Message[],
    tools?: ToolDefinition[],
    system?: string,
  ): AsyncGenerator<string> {
    yield* this._provider.chatStream(messages, tools ?? [], system);
  }

  supportsToolCalling(): boolean {
    return this._supportsTools;
  }

  supportsStreaming(): boolean {
    return this._supportsStreaming;
  }

  getModelInfo(): Record<string, unknown> {
    return { model: this._model, supportsTools: this._supportsTools };
  }

  countTokens(text: string): number {
    return estimateTokens(text);
  }
}

export class CachedLLMService extends LLMService {
  private _inner: LLMService;
  private _cache: LLMCache;
  private _ttl: number;

  constructor(inner: LLMService, cache: LLMCache, ttl = 3600) {
    super();
    this._inner = inner;
    this._cache = cache;
    this._ttl = ttl;
  }

  private _cacheKey(messages: Message[], tools?: ToolDefinition[]): string {
    const data = JSON.stringify({ messages, tools: tools?.map((t) => t.name) });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const chr = data.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return `llm:${Math.abs(hash).toString(36)}`;
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    system?: string,
  ): Promise<LLMResponse> {
    const key = this._cacheKey(messages, tools);
    const cached = await this._cache.get(key);
    if (cached) return cached;

    const response = await this._inner.chat(messages, tools, system);
    await this._cache.set(key, response, this._ttl).catch(() => {});
    return response;
  }

  async *stream(
    messages: Message[],
    tools?: ToolDefinition[],
    system?: string,
  ): AsyncGenerator<string> {
    yield* this._inner.stream(messages, tools, system);
  }

  supportsToolCalling(): boolean {
    return this._inner.supportsToolCalling();
  }

  supportsStreaming(): boolean {
    return this._inner.supportsStreaming();
  }

  getModelInfo(): Record<string, unknown> {
    return { ...this._inner.getModelInfo(), cached: true };
  }

  countTokens(text: string): number {
    return this._inner.countTokens(text);
  }
}
