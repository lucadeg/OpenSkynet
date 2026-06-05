import { test, describe, expect, beforeEach } from "bun:test";
import { InterruptSignal, AgentInterruptedError } from "../../src/agent/interrupt";

describe("InterruptSignal", () => {
  let signal: InterruptSignal;

  beforeEach(() => {
    signal = new InterruptSignal();
  });

  test("trigger sets triggered flag", () => {
    signal.trigger("user cancel");
    expect(signal.triggered).toBe(true);
    expect(signal.reason).toBe("user cancel");
  });

  test("check throws when triggered", () => {
    signal.trigger("stop");
    expect(() => signal.check()).toThrow(AgentInterruptedError);
    expect(() => signal.check()).toThrow("stop");
  });

  test("check does not throw when not triggered", () => {
    expect(signal.triggered).toBe(false);
    expect(() => signal.check()).not.toThrow();
  });

  test("reset clears state", () => {
    signal.trigger("reason");
    signal.reset();
    expect(signal.triggered).toBe(false);
    expect(signal.reason).toBe("");
    expect(() => signal.check()).not.toThrow();
  });
});
