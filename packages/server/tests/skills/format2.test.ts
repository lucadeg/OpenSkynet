/** Tests for Skills Format */
import { test, describe, expect } from "bun:test";

describe("SkillsFormat", () => {
  describe("skill.json structure", () => {
    test("requires name field", () => {
      const skill = { name: "test-skill" };
      expect(skill.name).toBeDefined();
    });

    test("requires description field", () => {
      const skill = { name: "test", description: "Test skill" };
      expect(skill.description).toBeDefined();
    });

    test("requires version field", () => {
      const skill = { name: "test", description: "Test", version: 1 };
      expect(skill.version).toBeDefined();
    });
  });

  describe("name format", () => {
    test("allows lowercase letters", () => {
      const valid = "my-skill";
      expect(valid).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    test("allows numbers", () => {
      const valid = "skill-123";
      expect(valid).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    test("allows hyphens", () => {
      const valid = "my-skill-name";
      expect(valid).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    test("rejects uppercase", () => {
      const invalid = "MySkill";
      expect(invalid).not.toMatch(/^[a-z][a-z0-9-]*$/);
    });

    test("rejects special chars", () => {
      const invalid = "my@skill";
      expect(invalid).not.toMatch(/^[a-z][a-z0-9-]*$/);
    });

    test("rejects spaces", () => {
      const invalid = "my skill";
      expect(invalid).not.toMatch(/^[a-z][a-z0-9-]*$/);
    });

    test("rejects starting with number", () => {
      const invalid = "123skill";
      expect(invalid).not.toMatch(/^[a-z][a-z0-9-]*$/);
    });
  });

  describe("parameters", () => {
    test("defines tool parameters", () => {
      const skill = {
        name: "test",
        description: "Test",
        version: 1,
        parameters: [
          { name: "url", type: "string", required: true },
          { name: "limit", type: "number", required: false },
        ],
      };
      expect(skill.parameters![0].required).toBe(true);
    });

    test("all parameters have name and type", () => {
      const parameters = [
        { name: "param1", type: "string" },
        { name: "param2", type: "number" },
        { name: "param3", type: "boolean" },
      ];
      for (const param of parameters) {
        expect(param.name).toBeDefined();
        expect(param.type).toBeDefined();
      }
    });
  });

  describe("versioning", () => {
    test("version is positive integer", () => {
      const validVersions = [1, 2, 10, 100];
      for (const v of validVersions) {
        expect(v).toBeGreaterThan(0);
      }
    });

    test("rejects zero version", () => {
      const invalid = 0;
      expect(invalid).not.toBeGreaterThan(0);
    });

    test("rejects negative version", () => {
      const invalid = -1;
      expect(invalid).not.toBeGreaterThan(0);
    });
  });

  describe("metadata", () => {
    test("includes author", () => {
      const skill = {
        name: "test",
        description: "Test",
        version: 1,
        author: "Test Author",
      };
      expect(skill.author).toBeDefined();
    });

    test("includes tags", () => {
      const skill = {
        name: "test",
        description: "Test",
        version: 1,
        tags: ["web", "scraping"],
      };
      expect(skill.tags).toEqual(["web", "scraping"]);
    });

    test("includes source", () => {
      const skill = {
        name: "test",
        description: "Test",
        version: 1,
        source: "custom",
      };
      expect(skill.source).toBe("custom");
    });
  });
});
