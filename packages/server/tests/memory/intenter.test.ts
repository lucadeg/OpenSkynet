import { test, describe, expect } from "bun:test";
import { Intenter } from "../../src/memory/strategies/hy/intenter";

describe("Intenter", () => {
  const intenter = new Intenter();

  test("detects storage intent for remember commands", () => {
    const result = intenter.detectIntent("Please remember this important detail about the project");
    expect(result.wantsMemory).toBe(true);
    expect(result.wantsRecall).toBe(false);
  });

  test("detects storage intent for save commands", () => {
    const result = intenter.detectIntent("Save this: my API key endpoint is /v2/data");
    expect(result.wantsMemory).toBe(true);
  });

  test("detects storage intent for 'don't forget'", () => {
    const result = intenter.detectIntent("Don't forget to deploy on Fridays");
    expect(result.wantsMemory).toBe(true);
  });

  test("detects recall intent for do you remember", () => {
    const result = intenter.detectIntent("Do you remember what I told you about the project?");
    expect(result.wantsRecall).toBe(true);
  });

  test("detects recall intent for do you remember", () => {
    const result = intenter.detectIntent("Do you remember my preferences for the editor?");
    expect(result.wantsRecall).toBe(true);
  });

  test("returns false for general questions", () => {
    const result = intenter.detectIntent("How is the weather today?");
    expect(result.wantsMemory).toBe(false);
    expect(result.wantsRecall).toBe(false);
  });
});
