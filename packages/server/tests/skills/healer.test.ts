import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SkillHealer } from "../../src/skills/healer";

describe("SkillHealer", () => {
  let skillsDir: string;
  let cleanup: () => void;

  beforeEach(() => {
    skillsDir = mkdtempSync(join(tmpdir(), "healer-test-"));
    cleanup = () => rmSync(skillsDir, { recursive: true, force: true });
  });

  afterEach(() => {
    cleanup();
  });

  function makeEngine(): any {
    return { skillsDir };
  }

  function writeSkill(name: string, data: Record<string, unknown>) {
    const dir = join(skillsDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "skill.json"), JSON.stringify(data, null, 2));
  }

  test("heals missing fields", () => {
    writeSkill("test-skill", {
      description: "A test skill",
      steps: ["do something"],
      version: 1,
    });

    const healer = new SkillHealer();
    const result = healer.heal("test-skill", makeEngine());
    expect(result.healed).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  test("reports changes for missing name", () => {
    writeSkill("my-skill", {
      description: "desc",
      steps: ["step"],
      version: 1,
    });

    const healer = new SkillHealer();
    const result = healer.heal("my-skill", makeEngine());
    expect(result.healed).toBe(true);
    expect(result.changes.some((c) => c.includes("name"))).toBe(true);
  });

  test("reports changes for missing description", () => {
    writeSkill("my-skill", {
      name: "my-skill",
      steps: ["step"],
      version: 1,
    });

    const healer = new SkillHealer();
    const result = healer.heal("my-skill", makeEngine());
    expect(result.healed).toBe(true);
    expect(result.changes.some((c) => c.includes("description"))).toBe(true);
  });

  test("generates steps from structured_steps", () => {
    writeSkill("my-skill", {
      name: "my-skill",
      description: "desc",
      version: 1,
      structured_steps: [{ description: "structured step one" }],
    });

    const healer = new SkillHealer();
    const result = healer.heal("my-skill", makeEngine());
    expect(result.healed).toBe(true);
    expect(result.changes.some((c) => c.includes("structured_steps"))).toBe(true);
  });

  test("returns false for missing directory", () => {
    const healer = new SkillHealer();
    const result = healer.heal("nonexistent", makeEngine());
    expect(result.healed).toBe(false);
    expect(result.changes.length).toBeGreaterThan(0);
  });
});
