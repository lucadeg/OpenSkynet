import { test, describe, expect } from "bun:test";
import {
  createInitialState,
  transitionPhase,
  addObservation,
  addReflection,
  addPlanStep,
} from "../../src/agent/state";
import type { Observation } from "../../src/core/types";

describe("agent state machine", () => {
  test("createInitialState returns correct defaults", () => {
    const state = createInitialState();
    expect(state.phase).toBe("planning");
    expect(state.currentStrategy).toBe("direct");
    expect(state.steps).toEqual([]);
    expect(state.observations).toEqual([]);
    expect(state.reflections).toEqual([]);
    expect(state.iterationCount).toBe(0);
  });

  test("transitionPhase changes phase", () => {
    const state = createInitialState();
    const updated = transitionPhase(state, "executing");
    expect(updated.phase).toBe("executing");
    expect(state.phase).toBe("planning");
  });

  test("addObservation adds to list", () => {
    const state = createInitialState();
    const obs: Observation = { phase: "executing", action: "navigate", result: "ok" };
    const updated = addObservation(state, obs);
    expect(updated.observations.length).toBe(1);
    expect(updated.observations[0].action).toBe("navigate");
    expect(state.observations.length).toBe(0);
  });

  test("addReflection adds to list", () => {
    const state = createInitialState();
    const updated = addReflection(state, { success: true, analysis: "looks good" });
    expect(updated.reflections.length).toBe(1);
  });

  test("addPlanStep adds to list", () => {
    const state = createInitialState();
    const updated = addPlanStep(state, { index: 0, description: "plan step", strategy: "direct", status: "pending" });
    expect(updated.steps.length).toBe(1);
  });
});
