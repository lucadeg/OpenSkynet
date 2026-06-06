import { test, describe, expect } from "bun:test";
import { BaseMemoryStrategy } from "../../src/memory/strategy";

describe("BaseMemoryStrategy", () => {
  test("has static name method returning 'base'", () => {
    expect(BaseMemoryStrategy.name()).toBe("base");
  });

  test("can be instantiated (abstract methods are undefined)", () => {
    const instance = new (BaseMemoryStrategy as any)();
    expect(instance).toBeDefined();
    expect(instance.initialize).toBeUndefined();
    expect(instance.write).toBeUndefined();
  });

  test("default review returns empty array", async () => {
    const instance = new (BaseMemoryStrategy as any)();
    const result = await instance.review([]);
    expect(result).toEqual([]);
  });

  test("shouldReview returns false", () => {
    const instance = new (BaseMemoryStrategy as any)();
    expect(instance.shouldReview(100)).toBe(false);
  });

  test("getToolSchema returns null", () => {
    const instance = new (BaseMemoryStrategy as any)();
    expect(instance.getToolSchema()).toBeNull();
  });

  test("getToolSchemas returns empty array when no schema", () => {
    const instance = new (BaseMemoryStrategy as any)();
    expect(instance.getToolSchemas()).toEqual([]);
  });

  test("version getter returns 1.0.0", () => {
    const instance = new (BaseMemoryStrategy as any)();
    expect(instance.version).toBe("1.0.0");
  });
});
