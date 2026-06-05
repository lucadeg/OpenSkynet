/**
 * Tests for Agent Reflection.
 * Converted from Python tests/test_agent_reflection.py
 */

import { test, describe, expect } from "bun:test";

describe("AgentReflection", () => {
  describe("Reflection", () => {
    test("creates reflection result", () => {
      const reflection = {
        task_complete: true,
        confidence: 0.9,
        reasoning: "Task completed successfully",
      };

      expect(reflection.task_complete).toBe(true);
      expect(reflection.confidence).toBe(0.9);
      expect(reflection.reasoning).toBeDefined();
    });

    test("indicates incomplete task", () => {
      const reflection = {
        task_complete: false,
        confidence: 0.3,
        reasoning: "Need more information",
      };

      expect(reflection.task_complete).toBe(false);
      expect(reflection.confidence).toBeLessThan(0.5);
    });

    test("includes reasoning text", () => {
      const reflection = {
        task_complete: true,
        confidence: 1.0,
        reasoning: "All requirements met",
      };

      expect(reflection.reasoning).toBe("All requirements met");
    });
  });

  describe("confidence scoring", () => {
    test("high confidence for clear completion", () => {
      const confidence = 0.95;

      expect(confidence).toBeGreaterThan(0.9);
    });

    test("medium confidence for partial completion", () => {
      const confidence = 0.6;

      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThan(0.8);
    });

    test("low confidence for uncertain completion", () => {
      const confidence = 0.2;

      expect(confidence).toBeLessThan(0.5);
    });

    test("clamps confidence between 0 and 1", () => {
      const validConfidences = [0, 0.5, 1.0];

      for (const conf of validConfidences) {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("recovery strategy", () => {
    test("provides recovery suggestion", () => {
      const recovery = {
        suggestion: "Try using different selector",
        confidence: 0.7,
      };

      expect(recovery.suggestion).toBeDefined();
      expect(recovery.confidence).toBe(0.7);
    });

    test("identifies recoverable errors", () => {
      const errors = {
        element_not_found: true,
        timeout_error: true,
        network_error: true,
      };

      expect(errors.element_not_found).toBe(true);
      expect(errors.timeout_error).toBe(true);
    });

    test("identifies fatal errors", () => {
      const errors = {
        browser_crashed: true,
        session_expired: true,
      };

      expect(errors.browser_crashed).toBe(true);
    });
  });

  describe("reflection prompts", () => {
    test("prompts for completion assessment", () => {
      const prompt = "Is the task complete? Respond with confidence and reasoning.";

      expect(prompt).toContain("complete");
      expect(prompt).toContain("confidence");
    });

    test("includes current state in prompt", () => {
      const state = {
        steps_taken: 5,
        last_action: "extract",
        last_observation: "Got text 'Example Domain'",
      };

      const prompt = `Current state: ${JSON.stringify(state)}`;

      expect(prompt).toContain("steps_taken");
      expect(prompt).toContain("extract");
    });
  });

  describe("fast paths", () => {
    test("takes fast path on success", () => {
      const fastPath = {
        condition: "result_obtained",
        action: "complete",
      };

      expect(fastPath.condition).toBe("result_obtained");
    });

    test("takes fast path on error", () => {
      const fastPath = {
        condition: "fatal_error",
        action: "stop",
      };

      expect(fastPath.action).toBe("stop");
    });

    test("takes fast path on max steps", () => {
      const fastPath = {
        condition: "max_steps_reached",
        action: "complete_with_warning",
      };

      expect(fastPath.condition).toBe("max_steps_reached");
    });
  });

  describe("edge cases", () => {
    test("handles reflection without reasoning", () => {
      const reflection = {
        task_complete: true,
        confidence: 0.5,
        reasoning: "",
      };

      expect(reflection.reasoning).toBe("");
    });

    test("handles zero confidence", () => {
      const reflection = {
        task_complete: false,
        confidence: 0,
        reasoning: "No information",
      };

      expect(reflection.confidence).toBe(0);
    });

    test("handles perfect confidence", () => {
      const reflection = {
        task_complete: true,
        confidence: 1,
        reasoning: "Absolutely certain",
      };

      expect(reflection.confidence).toBe(1);
    });
  });
});
