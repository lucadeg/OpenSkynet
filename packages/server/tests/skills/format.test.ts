import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { tmpSedimanDir } from "../fixtures";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("skill format", () => {
  let dir: string;
  let cleanup: () => void;

  beforeEach(() => {
    ({ dir, cleanup } = tmpSedimanDir());
  });

  afterEach(() => {
    cleanup();
  });

  test("SkillDataSchema validates correct data", async () => {
    const { SkillDataSchema } = await import("../../src/skills/format?" + Date.now());
    const data = {
      name: "test-skill",
      description: "A test",
      steps: ["step 1", "step 2"],
      version: 1,
    };
    const parsed = SkillDataSchema.parse(data);
    expect(parsed.name).toBe("test-skill");
    expect(parsed.category).toBe("general");
  });

  test("SkillDataSchema rejects invalid data", async () => {
    const { SkillDataSchema } = await import("../../src/skills/format?" + Date.now());
    expect(() => SkillDataSchema.parse({})).toThrow();
  });

  test("loadSkill reads from directory", async () => {
    const { loadSkill } = await import("../../src/skills/format?" + Date.now());
    const skillDir = join(dir, "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "skill.json"),
      JSON.stringify({ name: "my-skill", description: "loaded", steps: ["a"], version: 1 }),
    );
    const skill = loadSkill(skillDir);
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("my-skill");
  });

  test("skillToSkillMd generates markdown", async () => {
    const { skillToSkillMd } = await import("../../src/skills/format?" + Date.now());
    const md = skillToSkillMd({
      name: "test-skill",
      description: "A test skill",
      steps: ["do thing one", "do thing two"],
      category: "testing",
      version: 2,
      variables: ["url", "selector"],
      when_to_use: "When testing",
      pitfalls: ["Don't do X"],
      verification: "Check output",
    });
    expect(md).toContain("# test-skill");
    expect(md).toContain("## Steps");
    expect(md).toContain("do thing one");
    expect(md).toContain("## Variables");
    expect(md).toContain("## Pitfalls");
    expect(md).toContain("## Verification");
  });
});
