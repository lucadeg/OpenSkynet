/** Tests for Agent Progress */
import { test, describe, expect } from "bun:test";
import { ProgressTracker, generateMilestonesPrompt, parseMilestones } from "../../../src/agent/progress";

describe("AgentProgress", () => {
  describe("ProgressTracker", () => {
    test("creates tracker", () => {
      const tracker = new ProgressTracker();
      expect(tracker).toBeDefined();
    });

    test("adds milestone", () => {
      const tracker = new ProgressTracker();
      tracker.addMilestone("test milestone");
      const milestones = tracker.getMilestones();
      expect(milestones).toHaveLength(1);
      expect(milestones[0].description).toBe("test milestone");
    });

    test("completes milestone", () => {
      const tracker = new ProgressTracker();
      tracker.addMilestone("test");
      tracker.completeMilestone(0);
      const milestones = tracker.getMilestones();
      expect(milestones[0].completed).toBe(true);
      expect(milestones[0].timestamp).toBeDefined();
    });

    test("gets progress", () => {
      const tracker = new ProgressTracker();
      tracker.addMilestone("step 1");
      tracker.addMilestone("step 2");
      tracker.completeMilestone(0);
      const progress = tracker.getProgress();
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(50);
    });

    test("calculates zero percentage for empty tracker", () => {
      const tracker = new ProgressTracker();
      const progress = tracker.getProgress();
      expect(progress.percentage).toBe(0);
    });
  });

  describe("generateMilestonesPrompt", () => {
    test("generates prompt for task", () => {
      const prompt = generateMilestonesPrompt("Build a house");
      expect(prompt).toContain("Build a house");
    });
  });

  describe("parseMilestones", () => {
    test("parses dash-prefixed milestones", () => {
      const text = "- Step one\n- Step two\n- Step three";
      const milestones = parseMilestones(text);
      expect(milestones).toEqual(["Step one", "Step two", "Step three"]);
    });

    test("parses bullet-prefixed milestones", () => {
      const text = "• Step one\n• Step two";
      const milestones = parseMilestones(text);
      expect(milestones).toEqual(["Step one", "Step two"]);
    });

    test("filters out empty lines", () => {
      const text = "- Step one\n\n- Step two";
      const milestones = parseMilestones(text);
      expect(milestones).toEqual(["Step one", "Step two"]);
    });

    test("handles empty input", () => {
      const milestones = parseMilestones("");
      expect(milestones).toEqual([]);
    });
  });
});
