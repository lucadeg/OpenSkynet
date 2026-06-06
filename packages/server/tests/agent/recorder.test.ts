import { test, describe, expect } from "bun:test";
import { SkillRecorder } from "../../src/agent/recorder";

describe("SkillRecorder", () => {
  test("recordStep adds steps", () => {
    const recorder = new SkillRecorder();
    recorder.recordStep("click button", "button clicked");
    recorder.recordStep("fill form", "form filled");
    expect(recorder.getSteps().length).toBe(2);
  });

  test("getSteps returns recorded action and observation", () => {
    const recorder = new SkillRecorder();
    recorder.recordStep("navigate", "page loaded");
    const steps = recorder.getSteps();
    expect(steps[0]).toEqual({ action: "navigate", observation: "page loaded" });
  });

  test("clear empties all steps", () => {
    const recorder = new SkillRecorder();
    recorder.recordStep("a", "b");
    recorder.recordStep("c", "d");
    recorder.clear();
    expect(recorder.getSteps()).toEqual([]);
  });

  test("getSteps returns empty array initially", () => {
    const recorder = new SkillRecorder();
    expect(recorder.getSteps()).toEqual([]);
  });
});
