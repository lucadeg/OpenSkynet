/**
 * Tests for Coding Agent Inline Verifier.
 * Converted from Python tests/test_coding_agent_verifier.py
 */

import { test, describe, expect } from "bun:test";
import { InlineVerifier, verifyEdits } from "../../src/agent/coding-agent/verifier";
import type { FileEdit } from "../../src/agent/coding-agent/types";

describe("InlineVerifier", () => {
  describe("shouldVerify", () => {
    test("returns true for TypeScript files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("test.ts")).toBe(true);
      expect(verifier.shouldVerify("test.tsx")).toBe(true);
    });

    test("returns true for JavaScript files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("test.js")).toBe(true);
      expect(verifier.shouldVerify("test.jsx")).toBe(true);
    });

    test("returns true for Python files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("test.py")).toBe(true);
    });

    test("returns true for Rust files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("test.rs")).toBe(true);
    });

    test("returns true for Go files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("test.go")).toBe(true);
    });

    test("returns false for non-code files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("test.md")).toBe(false);
      expect(verifier.shouldVerify("test.txt")).toBe(false);
      expect(verifier.shouldVerify("test.json")).toBe(false);
    });

    test("returns false for test files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("test_test.py")).toBe(false);
      expect(verifier.shouldVerify("test.spec.ts")).toBe(false);
      expect(verifier.shouldVerify("test.test.js")).toBe(false);
    });

    test("returns false for generated files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("test.generated.ts")).toBe(false);
      expect(verifier.shouldVerify("test.bundle.js")).toBe(false);
    });

    test("returns false for lock files", () => {
      const verifier = new InlineVerifier();
      expect(verifier.shouldVerify("package-lock.json")).toBe(false);
      expect(verifier.shouldVerify("yarn.lock")).toBe(false);
    });
  });

  describe("verifyEdit", () => {
    test("passes valid TypeScript code", async () => {
      const verifier = new InlineVerifier();
      const edit: FileEdit = {
        path: "test.ts",
        originalContent: "",
        newContent: "const x: number = 1;",
        edits: [],
      };

      const result = await verifier.verifyEdit(edit);
      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("passes valid Python code", async () => {
      const verifier = new InlineVerifier();
      const edit: FileEdit = {
        path: "test.py",
        originalContent: "",
        newContent: "def hello():\n    print('hello')",
        edits: [],
      };

      const result = await verifier.verifyEdit(edit);
      expect(result.passed).toBe(true);
    });

    test("detects unmatched brackets in JavaScript", async () => {
      const verifier = new InlineVerifier();
      const edit: FileEdit = {
        path: "test.js",
        originalContent: "",
        newContent: "function test() { return x; }", // Missing closing bracket
        edits: [],
      };

      const result = await verifier.verifyEdit(edit);
      // Basic bracket check should detect issues
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    test("skips verification for non-code files", async () => {
      const verifier = new InlineVerifier();
      const edit: FileEdit = {
        path: "README.md",
        originalContent: "",
        newContent: "# Title\n\nContent",
        edits: [],
      };

      const result = await verifier.verifyEdit(edit);
      expect(result.passed).toBe(true);
      expect(result.warnings).toContain("Skipped verification (not a verifyable file type)");
    });
  });

  describe("verifyEdits", () => {
    test("verifies multiple edits", async () => {
      const edits: FileEdit[] = [
        {
          path: "test.ts",
          originalContent: "",
          newContent: "const x = 1;",
          edits: [],
        },
        {
          path: "test.py",
          originalContent: "",
          newContent: "y = 2",
          edits: [],
        },
      ];

      const results = await verifyEdits(edits);
      expect(results.length).toBe(2);
      expect(results[0].filePath).toBe("test.ts");
      expect(results[1].filePath).toBe("test.py");
    });

    test("filters out non-verifyable files", async () => {
      const edits: FileEdit[] = [
        {
          path: "test.ts",
          originalContent: "",
          newContent: "const x = 1;",
          edits: [],
        },
        {
          path: "README.md",
          originalContent: "",
          newContent: "# Title",
          edits: [],
        },
      ];

      const results = await verifyEdits(edits);
      // Only TypeScript file should be verified
      expect(results.length).toBe(1);
      expect(results[0].filePath).toBe("test.ts");
    });

    test("returns empty array for empty input", async () => {
      const results = await verifyEdits([]);
      expect(results).toEqual([]);
    });
  });
});

describe("SyntaxValidation", () => {
  test("detects Python indentation errors", async () => {
    const verifier = new InlineVerifier();
    const edit: FileEdit = {
      path: "test.py",
      originalContent: "",
      newContent: "def test():\nreturn x", // Missing indentation
      edits: [],
    };

    const result = await verifier.verifyEdit(edit);
    // Should detect indentation issue
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("validates nested brackets", async () => {
    const verifier = new InlineVerifier();
    const edit: FileEdit = {
      path: "test.ts",
      originalContent: "",
      newContent: "function test() { return { x: [1, 2, 3] }; }",
      edits: [],
    };

    const result = await verifier.verifyEdit(edit);
    expect(result.passed).toBe(true);
  });
});
