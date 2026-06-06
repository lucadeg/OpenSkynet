const DEFAULT_MAX_CHARS = 5000;

const RETRYABLE_PATTERNS = [
  /rate.?limit/i,
  /timeout/i,
  /timed.?out/i,
  /connection/i,
  /network/i,
  /429/,
  /503/,
  /502/,
  /500/,
];

export class AgentHelpers {
  static truncateResult(result: string, maxChars: number = DEFAULT_MAX_CHARS): string {
    if (result.length <= maxChars) return result;
    return result.substring(0, maxChars) + `\n...[truncated ${result.length - maxChars} chars]`;
  }

  static formatToolResult(name: string, result: string): string {
    return `[${name}] ${result}`;
  }

  static isRetryable(error: Error): boolean {
    return RETRYABLE_PATTERNS.some((p) => p.test(error.message));
  }
}
