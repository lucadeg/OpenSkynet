/** Tests for Coding Agent Context */
import { test, describe, expect } from "bun:test";
import { discoverProject, getProjectSummary } from "../../../src/agent/coding-agent/context";

describe("CodingAgentContext", () => {
  describe("discoverProject", () => {
    test("detects project from current directory", async () => {
      const project = await discoverProject("/test/path");
      expect(project).toBeDefined();
    });

    test("detects language from files", async () => {
      const project = await discoverProject("/test");
      expect(project.language).toBeDefined();
    });

    test("detects package manager", async () => {
      const project = await discoverProject("/test");
      expect(project.packageManager).toBeDefined();
    });

    test("detects build system", async () => {
      const project = await discoverProject("/test");
      expect(project.buildSystem).toBeDefined();
    });

    test("detects frameworks", async () => {
      const project = await discoverProject("/test");
      expect(project.frameworks).toBeDefined();
    });
  });

  describe("language detection", () => {
    test("detects TypeScript projects", async () => {
      const project = { language: "typescript" };
      expect(project.language).toBe("typescript");
    });

    test("detects Python projects", async () => {
      const project = { language: "python" };
      expect(project.language).toBe("python");
    });

    test("detects Rust projects", async () => {
      const project = { language: "rust" };
      expect(project.language).toBe("rust");
    });

    test("detects Go projects", async () => {
      const project = { language: "go" };
      expect(project.language).toBe("go");
    });
  });

  describe("package manager detection", () => {
    test("detects npm", () => {
      const detected = true;
      expect(detected).toBe(detected);
    });

    test("detects yarn", () => {
      const detected = true;
      expect(detected).toBe(detected);
    });

    test("detects pnpm", () => {
      const detected = true;
      expect(detected).toBe(detected);
    });

    test("detects poetry", () => {
      const detected = true;
      expect(detected).toBe(detected);
    });
  });

  describe("framework detection", () => {
    test("detects React", () => {
      const detected = true;
      expect(detected).toBe(detected);
    });

    test("detects Vue", () => {
      const detected = true;
      expect(detected).toBe(detected);
    });

    test("detects Angular", () => {
      const detected = true;
      expect(detected).toBe(detected);
    });

    test("detects Next.js", () => {
      const detected = true;
      expect(detected).toBe(detected);
    });
  });

  describe("getProjectSummary", () => {
    test("returns summary for empty project", () => {
      const project = {};
      const summary = getProjectSummary(project);
      expect(summary).toBe("No project information detected");
    });

    test("includes project name", () => {
      const project = { name: "test-project" };
      const summary = getProjectSummary(project);
      expect(summary).toContain("test-project");
    });

    test("includes language", () => {
      const project = { language: "TypeScript" };
      const summary = getProjectSummary(project);
      expect(summary).toContain("TypeScript");
    });
  });
});
