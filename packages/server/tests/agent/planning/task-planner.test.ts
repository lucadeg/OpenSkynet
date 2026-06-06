import { test, describe, expect } from "bun:test";
import { TaskPlanner } from "../../../src/agent/planning/task-planner";

describe("TaskPlanner", () => {
  const planner = new TaskPlanner({} as any);

  test("planSync returns a TaskPlan with steps", () => {
    const plan = planner.planSync("fix the login bug", "coding");
    expect(plan.steps).toBeInstanceOf(Array);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0]).toHaveProperty("index");
    expect(plan.steps[0]).toHaveProperty("description");
    expect(plan.steps[0]).toHaveProperty("strategy");
    expect(plan.steps[0]).toHaveProperty("status");
  });

  test("planSync assigns direct strategy for coding tasks", () => {
    const plan = planner.planSync("fix the bug", "coding");
    expect(plan.strategy).toBe("direct");
  });

  test("planSync assigns delegate strategy for scheduling tasks", () => {
    const plan = planner.planSync("run every hour", "scheduling");
    expect(plan.strategy).toBe("delegate");
  });

  test("planSync assigns use_skill strategy when skill keyword present", () => {
    const plan = planner.planSync("use skill to deploy", "coding");
    expect(plan.strategy).toBe("use_skill");
  });

  test("planSync estimates complexity correctly", () => {
    const simple = planner.planSync("fix typo", "coding");
    expect(simple.estimatedComplexity).toBe("simple");

    const complex = planner.planSync("architect a comprehensive system", "coding");
    expect(complex.estimatedComplexity).toBe("complex");
  });

  test("planSync generates correct step count per category", () => {
    expect(planner.planSync("task", "coding").steps.length).toBe(3);
    expect(planner.planSync("task", "browser").steps.length).toBe(2);
    expect(planner.planSync("task", "scheduling").steps.length).toBe(2);
    expect(planner.planSync("task", "conversational").steps.length).toBe(1);
  });
});
