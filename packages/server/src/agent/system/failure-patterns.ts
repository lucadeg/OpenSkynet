export interface FailurePattern {
  pattern: RegExp;
  category: string;
  suggestion: string;
}

export const FAILURE_PATTERNS: FailurePattern[] = [
  {
    pattern: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network/i,
    category: "network",
    suggestion: "Check network connectivity and retry the request.",
  },
  {
    pattern: /rate.?limit|429|too many requests/i,
    category: "rate-limit",
    suggestion: "Implement exponential backoff and retry after a delay.",
  },
  {
    pattern: /out of memory|heap|OOM/i,
    category: "memory",
    suggestion: "Reduce payload size or increase available memory.",
  },
  {
    pattern: /permission denied|EACCES|forbidden/i,
    category: "permissions",
    suggestion: "Verify file/system permissions and access credentials.",
  },
  {
    pattern: /syntax error|parse error|unexpected token/i,
    category: "syntax",
    suggestion: "Review input format and fix syntax errors.",
  },
  {
    pattern: /timeout|timed out|deadline exceeded/i,
    category: "timeout",
    suggestion: "Increase timeout threshold or optimize the operation.",
  },
  {
    pattern: /not found|404|ENOENT/i,
    category: "not-found",
    suggestion: "Verify the target resource exists and the path is correct.",
  },
  {
    pattern: /context.?length|token.?limit|max.*tokens/i,
    category: "token-limit",
    suggestion: "Compress context or reduce the input size.",
  },
];

export function matchFailurePattern(error: string): FailurePattern | null {
  for (const fp of FAILURE_PATTERNS) {
    if (fp.pattern.test(error)) return fp;
  }
  return null;
}
