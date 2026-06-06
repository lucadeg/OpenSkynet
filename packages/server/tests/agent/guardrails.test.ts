import { test, describe, expect } from "bun:test";
import { assessRisk, checkBudget, AuditLog } from "../../src/agent/guardrails";
import type { Budget, RiskAssessment } from "../../src/agent/guardrails";

describe("assessRisk", () => {
  test("classifies high-risk actions", () => {
    const result = assessRisk("execute", { command: "rm -rf /" });
    expect(result.level).toBe("high");
  });

  test("classifies medium-risk actions", () => {
    const result = assessRisk("file_op", { path: ".env" });
    expect(result.level).toBe("medium");
  });

  test("classifies low-risk actions", () => {
    const result = assessRisk("read", { path: "/tmp/data.txt" });
    expect(result.level).toBe("low");
    expect(result.reasons).toEqual([]);
  });
});

describe("checkBudget", () => {
  const baseBudget: Budget = {
    maxTokens: 1000,
    maxIterations: 10,
    maxTimeMs: 60000,
    usedTokens: 0,
    usedIterations: 0,
    usedTimeMs: 0,
  };

  test("detects exceeded token budget", () => {
    const budget = { ...baseBudget, usedTokens: 1000 };
    const result = checkBudget(budget);
    expect(result.exceeded).toBe(true);
    expect(result.reason).toContain("Token");
  });

  test("detects exceeded iteration budget", () => {
    const budget = { ...baseBudget, usedIterations: 10 };
    const result = checkBudget(budget);
    expect(result.exceeded).toBe(true);
    expect(result.reason).toContain("Iteration");
  });

  test("detects exceeded time budget", () => {
    const budget = { ...baseBudget, usedTimeMs: 60000 };
    const result = checkBudget(budget);
    expect(result.exceeded).toBe(true);
    expect(result.reason).toContain("Time");
  });

  test("returns not exceeded for under-budget", () => {
    const result = checkBudget(baseBudget);
    expect(result.exceeded).toBe(false);
    expect(result.reason).toBeUndefined();
  });
});

describe("AuditLog", () => {
  test("records entries", () => {
    const log = new AuditLog();
    const risk: RiskAssessment = { level: "low", reasons: [] };
    log.add("test_action", "test details", risk);
    const entries = log.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe("test_action");
    expect(entries[0].risk.level).toBe("low");
  });

  test("clear removes all entries", () => {
    const log = new AuditLog();
    log.add("action", "detail", { level: "low", reasons: [] });
    log.clear();
    expect(log.getEntries().length).toBe(0);
  });
});
