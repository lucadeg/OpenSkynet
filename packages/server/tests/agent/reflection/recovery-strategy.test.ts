import { test, describe, expect } from "bun:test";
import { RecoveryStrategy } from "../../../src/agent/reflection/recovery-strategy";

describe("RecoveryStrategy", () => {
  test("determine returns retry for rate limit errors", () => {
    const strategy = new RecoveryStrategy();
    const result = strategy.determine(new Error("rate limit exceeded"), 0);
    expect(result.action).toBe("retry");
    expect(result.params?.delayMs).toBeDefined();
  });

  test("determine returns retry for 429 errors", () => {
    const strategy = new RecoveryStrategy();
    const result = strategy.determine(new Error("HTTP 429 Too Many Requests"), 1);
    expect(result.action).toBe("retry");
  });

  test("determine returns retry for timeout with low step count", () => {
    const strategy = new RecoveryStrategy();
    const result = strategy.determine(new Error("Request timeout"), 2);
    expect(result.action).toBe("retry");
    expect(result.params?.timeout).toBe(60000);
  });

  test("determine returns simplify for timeout with high step count", () => {
    const strategy = new RecoveryStrategy();
    const result = strategy.determine(new Error("Request timed out"), 5);
    expect(result.action).toBe("simplify");
  });

  test("determine returns abort for auth errors", () => {
    const strategy = new RecoveryStrategy();
    expect(strategy.determine(new Error("Unauthorized access"), 0).action).toBe("abort");
    expect(strategy.determine(new Error("Auth failure"), 0).action).toBe("abort");
    expect(strategy.determine(new Error("Forbidden"), 0).action).toBe("abort");
  });

  test("determine returns abort for not found errors", () => {
    const strategy = new RecoveryStrategy();
    expect(strategy.determine(new Error("File not found"), 0).action).toBe("abort");
    expect(strategy.determine(new Error("ENOENT: no such file"), 0).action).toBe("abort");
  });

  test("determine returns retry for unknown errors with low step count", () => {
    const strategy = new RecoveryStrategy();
    const result = strategy.determine(new Error("Something went wrong"), 3);
    expect(result.action).toBe("retry");
  });

  test("determine returns simplify for unknown errors with high step count", () => {
    const strategy = new RecoveryStrategy();
    const result = strategy.determine(new Error("Something went wrong"), 6);
    expect(result.action).toBe("simplify");
    expect(result.params?.maxSteps).toBe(3);
  });
});
