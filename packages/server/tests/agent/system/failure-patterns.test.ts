import { test, describe, expect } from "bun:test";
import { matchFailurePattern, FAILURE_PATTERNS } from "../../../src/agent/system/failure-patterns";

describe("matchFailurePattern", () => {
  test("matches network errors", () => {
    const result = matchFailurePattern("ECONNREFUSED: connection refused");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("network");
  });

  test("matches rate limit errors", () => {
    const result = matchFailurePattern("429 too many requests");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("rate-limit");
  });

  test("matches timeout errors", () => {
    const result = matchFailurePattern("request timed out after 30s");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("timeout");
  });

  test("matches permission errors", () => {
    const result = matchFailurePattern("EACCES permission denied");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("permissions");
  });

  test("matches not-found errors", () => {
    const result = matchFailurePattern("ENOENT: no such file or directory");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("not-found");
  });

  test("returns null for unknown errors", () => {
    expect(matchFailurePattern("something completely unexpected")).toBeNull();
  });

  test("each pattern has required fields", () => {
    for (const fp of FAILURE_PATTERNS) {
      expect(fp.pattern).toBeInstanceOf(RegExp);
      expect(typeof fp.category).toBe("string");
      expect(typeof fp.suggestion).toBe("string");
      expect(fp.category.length).toBeGreaterThan(0);
      expect(fp.suggestion.length).toBeGreaterThan(0);
    }
  });
});
