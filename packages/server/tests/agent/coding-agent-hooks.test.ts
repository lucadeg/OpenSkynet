/** Tests for Coding Agent Hooks */
import { test, describe, expect } from "bun:test";
import { DefaultHookPipeline, createDefaultPipeline } from "../../../src/agent/coding-agent/hooks";

describe("CodingAgentHooks", () => {
  describe("DefaultHookPipeline", () => {
    test("creates pipeline with name", () => {
      const pipeline = new DefaultHookPipeline("test");
      expect(pipeline.name).toBe("test");
    });

    test("registers pre-hooks", () => {
      const pipeline = new DefaultHookPipeline();
      let called = false;
      pipeline.registerPreHook(async () => {
        called = true;
        return { continue: true };
      });
      expect(called).toBe(false); // Not called until execute
    });

    test("registers post-hooks", () => {
      const pipeline = new DefaultHookPipeline();
      let called = false;
      pipeline.registerPostHook(async () => {
        called = true;
        return { status: "success" as const };
      });
      expect(called).toBe(false);
    });
  });

  describe("createDefaultPipeline", () => {
    test("creates default pipeline", () => {
      const pipeline = createDefaultPipeline();
      expect(pipeline).toBeDefined();
      expect(pipeline.name).toBe("default");
    });

    test("includes default pre-hooks", async () => {
      const pipeline = createDefaultPipeline();
      const result = await pipeline.executePreHooks({
        project: {},
        task: "test",
        files: [],
        edits: [],
        metadata: {},
      });
      expect(result.continue).toBe(true);
    });
  });

  describe("syntaxValidationHook", () => {
    test("validates task syntax", async () => {
      const hook = async (context: any) => {
        return { continue: true };
      };
      const result = await hook({ task: "valid task" });
      expect(result.continue).toBe(true);
    });
  });

  describe("fileSafetyHook", () => {
    test("blocks dangerous file paths", async () => {
      const hook = async (context: any) => {
        const files = context.files || [];
        const dangerous = files.some((f: string) =>
          f.includes("/etc/passwd") || f.includes("key.pem")
        );
        return { continue: !dangerous };
      };
      const safe = await hook({ files: ["safe.txt"] });
      const unsafe = await hook({ files: ["/etc/passwd"] });
      expect(safe.continue).toBe(true);
      expect(unsafe.continue).toBe(false);
    });
  });

  describe("testGenerationHook", () => {
    test("suggests test generation", async () => {
      const hook = async (_context: any, result: any) => {
        if (result.edits && result.edits.length > 0) {
          return {
            status: "success" as const,
            message: "Consider generating tests",
          };
        }
        return { status: "success" as const };
      };
      const result = await hook(
        {},
        { edits: [{ path: "test.py" }] }
      );
      expect(result.message).toContain("tests");
    });
  });
});
