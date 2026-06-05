export type Message = Record<string, any>;

const CJK_RANGES = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\uac00-\ud7af]/;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(new RegExp(CJK_RANGES.source, "g")) || []).length;
  const nonCjk = text.length - cjkCount;
  return Math.ceil(nonCjk / 3 + cjkCount / 2);
}

export function estimateMessagesTokens(messages: Message[]): number {
  let total = 0;
  for (const m of messages) {
    const content = m.content;
    if (typeof content === "string") {
      total += estimateTokens(content);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part === "string") total += estimateTokens(part);
        else if (part?.text) total += estimateTokens(part.text);
      }
    }
    if (m.name) total += estimateTokens(String(m.name));
    if (m.tool_calls) {
      for (const tc of m.tool_calls) {
        total += estimateTokens(tc.function?.name ?? "");
        total += estimateTokens(tc.function?.arguments ?? "");
      }
    }
    total += 4;
  }
  return total;
}

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
  o1: 200000,
  "o1-mini": 128000,
  "o3-mini": 200000,
  "claude-3-5-sonnet": 200000,
  "claude-3-opus": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-haiku": 200000,
  "deepseek-chat": 64000,
  "deepseek-coder": 16000,
  "llama3": 8192,
  "llama3-70b": 8192,
  "mixtral-8x7b": 32000,
  "mistral-7b": 32000,
  "qwen2-72b": 32768,
  "yi-large": 32768,
};

const DEFAULT_CONTEXT_WINDOW = 8192;

export function getModelContextWindow(model: string): number {
  const lower = model.toLowerCase();
  for (const [key, win] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (lower.includes(key.toLowerCase())) return win;
  }
  return DEFAULT_CONTEXT_WINDOW;
}

export function getSafeContextBudget(model: string, reserveRatio = 0.25): number {
  const window = getModelContextWindow(model);
  return Math.floor(window * (1 - reserveRatio));
}

export const MODEL_COST_PER_1K_INPUT: Record<string, number> = {
  "gpt-4o": 0.0025,
  "gpt-4o-mini": 0.00015,
  "gpt-4-turbo": 0.01,
  "gpt-4": 0.03,
  "gpt-3.5-turbo": 0.0005,
  o1: 0.015,
  "o1-mini": 0.003,
  "o3-mini": 0.0011,
  "claude-3-5-sonnet": 0.003,
  "claude-3-opus": 0.015,
  "claude-3-haiku": 0.00025,
  "deepseek-chat": 0.00014,
  "deepseek-coder": 0.00014,
};

export const MODEL_COST_PER_1K_OUTPUT: Record<string, number> = {
  "gpt-4o": 0.01,
  "gpt-4o-mini": 0.0006,
  "gpt-4-turbo": 0.03,
  "gpt-4": 0.06,
  "gpt-3.5-turbo": 0.0015,
  o1: 0.06,
  "o1-mini": 0.012,
  "o3-mini": 0.0044,
  "claude-3-5-sonnet": 0.015,
  "claude-3-opus": 0.075,
  "claude-3-haiku": 0.00125,
  "deepseek-chat": 0.00028,
  "deepseek-coder": 0.00028,
};

export function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const lower = model.toLowerCase();
  let inputCost = 0.0;
  let outputCost = 0.0;
  for (const [key, cost] of Object.entries(MODEL_COST_PER_1K_INPUT)) {
    if (lower.includes(key.toLowerCase())) {
      inputCost = cost;
      break;
    }
  }
  for (const [key, cost] of Object.entries(MODEL_COST_PER_1K_OUTPUT)) {
    if (lower.includes(key.toLowerCase())) {
      outputCost = cost;
      break;
    }
  }
  return (inputTokens * inputCost + outputTokens * outputCost) / 1000;
}

export class TokenTracker {
  private _totalInputTokens = 0;
  private _totalOutputTokens = 0;
  private _totalCost = 0;
  private _totalCalls = 0;
  private _lastModel = "";

  record(model: string, inputTokens: number, outputTokens: number): void {
    this._totalInputTokens += inputTokens;
    this._totalOutputTokens += outputTokens;
    this._totalCalls += 1;
    this._totalCost += estimateCost(inputTokens, outputTokens, model);
    this._lastModel = model;
  }

  get totalInputTokens(): number {
    return this._totalInputTokens;
  }

  get totalOutputTokens(): number {
    return this._totalOutputTokens;
  }

  get totalCost(): number {
    return this._totalCost;
  }

  get totalCalls(): number {
    return this._totalCalls;
  }

  summary(): Record<string, unknown> {
    return {
      totalInputTokens: this._totalInputTokens,
      totalOutputTokens: this._totalOutputTokens,
      totalCost: this._totalCost,
      totalCalls: this._totalCalls,
      lastModel: this._lastModel,
    };
  }

  reset(): void {
    this._totalInputTokens = 0;
    this._totalOutputTokens = 0;
    this._totalCost = 0;
    this._totalCalls = 0;
    this._lastModel = "";
  }
}
