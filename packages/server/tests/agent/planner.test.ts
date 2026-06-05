import { test, describe, expect } from "bun:test";
import { TaskPlannerRegex } from "../../src/agent/planner";

describe("TaskPlannerRegex", () => {
  const planner = new TaskPlannerRegex();

  test("detectCron identifies English cron patterns", () => {
    const result = planner.detectCron("every day check the server");
    expect(result.isCron).toBe(true);
    expect(result.cronExpr).toBeDefined();
  });

  test("detectCron identifies cron expression format", () => {
    const result = planner.detectCron("0 * * * * run backup");
    expect(result.isCron).toBe(true);
    expect(result.cronExpr).toBe("0 * * * *");
    expect(result.actualTask).toBe("run backup");
  });

  test("detectCron identifies CJK cron patterns", () => {
    expect(planner.detectCron("每天检查服务器").isCron).toBe(true);
    expect(planner.detectCron("毎週レポート").isCron).toBe(true);
    expect(planner.detectCron("매일 실행").isCron).toBe(true);
  });

  test("detectCron returns null for non-cron text", () => {
    const result = planner.detectCron("write a hello world program");
    expect(result.isCron).toBe(false);
    expect(result.cronExpr).toBeUndefined();
  });

  test("detectUrl identifies URLs", () => {
    const result = planner.detectUrl("visit https://example.com/page");
    expect(result.isUrl).toBe(true);
    expect(result.url).toBe("https://example.com/page");
  });

  test("detectUrl returns false for non-URL text", () => {
    const result = planner.detectUrl("just some text");
    expect(result.isUrl).toBe(false);
    expect(result.url).toBeUndefined();
  });

  test("isSimpleTask returns true for short tasks", () => {
    expect(planner.isSimpleTask("fix typo")).toBe(true);
    expect(planner.isSimpleTask("run tests")).toBe(true);
  });

  test("isSimpleTask returns false for complex multi-step tasks", () => {
    expect(planner.isSimpleTask("first build the project and then deploy it after that")).toBe(false);
  });
});
