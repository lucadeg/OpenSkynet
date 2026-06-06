import { test, describe, expect } from "bun:test";
import { DefaultToolValidator } from "../../../src/agent/tools/validator";
import type { ToolDefinition } from "../../../src/core/types";

describe("DefaultToolValidator", () => {
  const validator = new DefaultToolValidator();

  const simpleTool: ToolDefinition = {
    name: "test_tool",
    description: "A test tool",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "number" },
      },
      required: ["name"],
    },
  };

  test("returns valid for correct params", () => {
    const result = validator.validate(simpleTool, { name: "hello" });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("returns errors for missing required params", () => {
    const result = validator.validate(simpleTool, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required parameter: name");
  });

  test("returns valid when optional params are omitted", () => {
    const result = validator.validate(simpleTool, { name: "test" });
    expect(result.valid).toBe(true);
  });

  test("returns errors for wrong type", () => {
    const result = validator.validate(simpleTool, { name: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("expected type string"))).toBe(true);
  });

  test("returns valid when no required fields and no args", () => {
    const noReqTool: ToolDefinition = {
      name: "empty",
      description: "No params",
      parameters: { type: "object", properties: {}, required: [] },
    };
    const result = validator.validate(noReqTool, {});
    expect(result.valid).toBe(true);
  });

  test("null value treated as missing required", () => {
    const result = validator.validate(simpleTool, { name: null });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required parameter: name");
  });

  test("handles undefined required", () => {
    const result = validator.validate(simpleTool, { name: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required parameter: name");
  });
});
