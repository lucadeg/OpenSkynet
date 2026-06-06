import { test, describe, expect } from "bun:test";
import { TurboHandler } from "../../../src/agent/fast-path/turbo-handler";

describe("TurboHandler", () => {
  test("isEligible returns true for simple short questions", () => {
    const handler = new TurboHandler();
    expect(handler.isEligible("What is 2+2?")).toBe(true);
    expect(handler.isEligible("Hello world")).toBe(true);
    expect(handler.isEligible("Define recursion")).toBe(true);
  });

  test("isEligible returns false for browser tasks", () => {
    const handler = new TurboHandler();
    expect(handler.isEligible("Navigate to google.com")).toBe(false);
    expect(handler.isEligible("Click the button")).toBe(false);
    expect(handler.isEligible("Take a screenshot")).toBe(false);
    expect(handler.isEligible("Scroll down")).toBe(false);
  });

  test("isEligible returns false for file/code/terminal tasks", () => {
    const handler = new TurboHandler();
    expect(handler.isEligible("Read the file")).toBe(false);
    expect(handler.isEligible("Write code to sort")).toBe(false);
    expect(handler.isEligible("Run shell command")).toBe(false);
    expect(handler.isEligible("Execute the script")).toBe(false);
    expect(handler.isEligible("Type hello into input")).toBe(false);
  });

  test("isEligible returns false for long tasks", () => {
    const handler = new TurboHandler();
    const longTask = "a".repeat(51);
    expect(handler.isEligible(longTask)).toBe(false);
    const edgeCase = "a".repeat(50);
    expect(handler.isEligible(edgeCase)).toBe(false);
    const justUnder = "a".repeat(49);
    expect(handler.isEligible(justUnder)).toBe(true);
  });

  test("isEligible returns false for download/upload tasks", () => {
    const handler = new TurboHandler();
    expect(handler.isEligible("Download the report")).toBe(false);
    expect(handler.isEligible("Upload the file")).toBe(false);
  });
});
