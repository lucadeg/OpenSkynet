import { test, describe, expect } from "bun:test";
import { checkPermission, DEFAULT_PERMISSIONS } from "../../../src/agent/subagents/permissions";
import type { PermissionRules } from "../../../src/agent/subagents/permissions";

describe("checkPermission", () => {
  test("allows tools when wildcard is allowed", () => {
    const result = checkPermission(DEFAULT_PERMISSIONS, "any_tool");
    expect(result.allowed).toBe(true);
  });

  test("denies explicitly denied tools", () => {
    const rules: PermissionRules = {
      ...DEFAULT_PERMISSIONS,
      deniedTools: ["dangerous_tool"],
    };
    const result = checkPermission(rules, "dangerous_tool");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("explicitly denied");
  });

  test("denies all tools when wildcard is denied", () => {
    const rules: PermissionRules = {
      ...DEFAULT_PERMISSIONS,
      allowedTools: ["read"],
      deniedTools: ["*"],
    };
    const result = checkPermission(rules, "read");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("All tools are denied");
  });

  test("denies tools not in allowed list when no wildcard", () => {
    const rules: PermissionRules = {
      allowedTools: ["read", "write"],
      deniedTools: [],
      maxIterations: 10,
      maxTimeMs: 60000,
      requireApproval: [],
    };
    const result = checkPermission(rules, "delete");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in the allowed list");
  });

  test("allows tools explicitly in allowed list", () => {
    const rules: PermissionRules = {
      allowedTools: ["read", "write"],
      deniedTools: [],
      maxIterations: 10,
      maxTimeMs: 60000,
      requireApproval: [],
    };
    expect(checkPermission(rules, "read").allowed).toBe(true);
    expect(checkPermission(rules, "write").allowed).toBe(true);
  });

  test("denied takes priority over allowed wildcard", () => {
    const rules: PermissionRules = {
      ...DEFAULT_PERMISSIONS,
      deniedTools: ["bash"],
    };
    expect(checkPermission(rules, "bash").allowed).toBe(false);
    expect(checkPermission(rules, "read").allowed).toBe(true);
  });
});
