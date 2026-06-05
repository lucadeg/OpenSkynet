import { test, describe, expect } from "bun:test";
import { ProgressTracker, generateMilestonesPrompt, parseMilestones } from "../../src/agent/progress";

describe("ProgressTracker", () => {
  test("addMilestone and getMilestones", () => {
    const tracker = new ProgressTracker();
    tracker.addMilestone("Step 1");
    tracker.addMilestone("Step 2");
    const milestones = tracker.getMilestones();
    expect(milestones.length).toBe(2);
    expect(milestones[0].description).toBe("Step 1");
    expect(milestones[0].completed).toBe(false);
  });

  test("completeMilestone marks done", () => {
    const tracker = new ProgressTracker();
    tracker.addMilestone("Step 1");
    tracker.addMilestone("Step 2");
    tracker.completeMilestone(0);
    const milestones = tracker.getMilestones();
    expect(milestones[0].completed).toBe(true);
    expect(milestones[0].timestamp).toBeDefined();
    expect(milestones[1].completed).toBe(false);
  });

  test("getProgress calculates percentage", () => {
    const tracker = new ProgressTracker();
    tracker.addMilestone("A");
    tracker.addMilestone("B");
    tracker.addMilestone("C");
    tracker.completeMilestone(0);
    const progress = tracker.getProgress();
    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(1);
    expect(progress.percentage).toBe(33);
  });

  test("getProgress returns 0 for no milestones", () => {
    const tracker = new ProgressTracker();
    const progress = tracker.getProgress();
    expect(progress.total).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  test("completeMilestone ignores invalid index", () => {
    const tracker = new ProgressTracker();
    tracker.addMilestone("A");
    tracker.completeMilestone(-1);
    tracker.completeMilestone(99);
    expect(tracker.getMilestones()[0].completed).toBe(false);
  });
});

describe("generateMilestonesPrompt", () => {
  test("returns string containing the task", () => {
    const prompt = generateMilestonesPrompt("build a website");
    expect(typeof prompt).toBe("string");
    expect(prompt).toContain("build a website");
    expect(prompt).toContain("milestones");
  });
});

describe("parseMilestones", () => {
  test("parses dash-prefixed lines", () => {
    const text = "- Step one\n- Step two\nSome other text\n- Step three";
    const result = parseMilestones(text);
    expect(result).toEqual(["Step one", "Step two", "Step three"]);
  });

  test("returns empty array for no matching lines", () => {
    expect(parseMilestones("no milestones here")).toEqual([]);
  });
});
