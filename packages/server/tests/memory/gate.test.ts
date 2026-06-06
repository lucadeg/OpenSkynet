import { test, describe, expect } from "bun:test";
import { MemoryGate } from "../../src/memory/strategies/hy/gate";

describe("MemoryGate", () => {
  const gate = new MemoryGate();

  test("shouldStore returns true for meaningful content", () => {
    expect(gate.shouldStore("I prefer using TypeScript for all backend projects", "preference")).toBe(true);
    expect(gate.shouldStore("The database is hosted on AWS RDS with PostgreSQL", "fact")).toBe(true);
  });

  test("shouldStore returns false for trivial content", () => {
    expect(gate.shouldStore("ok", "fact")).toBe(false);
    expect(gate.shouldStore("yes", "fact")).toBe(false);
    expect(gate.shouldStore("thanks", "fact")).toBe(false);
    expect(gate.shouldStore("lol", "fact")).toBe(false);
  });

  test("shouldStore returns false for short content", () => {
    expect(gate.shouldStore("hi", "fact")).toBe(false);
    expect(gate.shouldStore("short", "fact")).toBe(false);
  });

  test("getImportance returns higher for preferences", () => {
    const prefScore = gate.getImportance("I prefer dark mode in all editors", "preference");
    const factScore = gate.getImportance("The server runs on port 3000", "fact");
    expect(prefScore).toBeGreaterThan(factScore);
  });

  test("getImportance boosts for important/critical keywords", () => {
    const normal = gate.getImportance("The config file is in the root directory", "fact");
    const critical = gate.getImportance("This is critical to always remember for deployment", "fact");
    expect(critical).toBeGreaterThan(normal);
  });

  test("getImportance reduces for hedging words", () => {
    const normal = gate.getImportance("The server uses Node.js for the backend", "fact");
    const hedging = gate.getImportance("The server maybe uses Node.js perhaps", "fact");
    expect(normal).toBeGreaterThan(hedging);
  });
});
