import type { LLMProvider } from "./provider";
import type { LLMService, LLMCache, LLMMetrics } from "./service";
import { BasicLLMService } from "./impl";

class StreamingOnlyService extends BasicLLMService {
  constructor(provider: LLMProvider, model: string) {
    super(provider, model, false, true);
  }
}

class ToolOnlyService extends BasicLLMService {
  constructor(provider: LLMProvider, model: string) {
    super(provider, model, true, false);
  }
}

class FastService extends BasicLLMService {
  constructor(provider: LLMProvider, model: string) {
    super(provider, model, true, true);
  }
}

export class DefaultLLMServiceFactory {
  private _provider: LLMProvider;
  private _cache?: LLMCache;
  private _metrics?: LLMMetrics;

  constructor(provider: LLMProvider, cache?: LLMCache, metrics?: LLMMetrics) {
    this._provider = provider;
    this._cache = cache;
    this._metrics = metrics;
  }

  createChatService(model: string): LLMService {
    return new BasicLLMService(this._provider, model);
  }

  createStreamingService(model: string): LLMService {
    return new StreamingOnlyService(this._provider, model);
  }

  createToolService(model: string): LLMService {
    return new ToolOnlyService(this._provider, model);
  }

  createFastService(model: string): LLMService {
    return new FastService(this._provider, model);
  }
}
