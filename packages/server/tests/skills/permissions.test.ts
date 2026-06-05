import { test, describe, expect } from "bun:test";
import { checkPermission, getSkillPermissions } from "../../src/skills/permissions";

describe("permissions", () => {
  test("checkPermission allows when no restrictions", () => {
    const skill = {};
    expect(checkPermission(skill, "terminal_exec")).toBe(true);
    expect(checkPermission(skill, "browser_navigate")).toBe(true);
  });

  test("checkPermission allows when tool is in allowedTools", () => {
    const skill = {
      allowed_tools: { terminal_exec: "terminal_exec", browser_navigate: "browser_navigate" },
    };
    expect(checkPermission(skill, "terminal_exec")).toBe(true);
  });

  test("checkPermission denies when tool not in allowedTools", () => {
    const skill = {
      allowed_tools: { terminal_exec: "terminal_exec" },
    };
    expect(checkPermission(skill, "browser_navigate")).toBe(false);
  });

  test("checkPermission handles tool with colon suffix", () => {
    const skill = {
      allowed_tools: { browser_click: "browser_click" },
    };
    expect(checkPermission(skill, "browser_click:some-arg")).toBe(true);
  });

  test("getSkillPermissions returns correct structure", () => {
    const skill = {
      allowed_tools: { tool_a: "tool_a", tool_b: "tool_b" },
      disable_model_invocation: true,
    };
    const perms = getSkillPermissions(skill);
    expect(perms.allowedTools).toContain("tool_a");
    expect(perms.allowedTools).toContain("tool_b");
    expect(perms.requiresConfirmation).toBe(true);
  });

  test("getSkillPermissions with no restrictions", () => {
    const perms = getSkillPermissions({});
    expect(perms.allowedTools).toBeUndefined();
    expect(perms.requiresConfirmation).toBe(false);
  });
});
