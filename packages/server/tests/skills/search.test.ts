import { test, describe, expect } from "bun:test";
import { SkillSearchEngine } from "../../src/skills/search";

function makeEngine(skills: Array<Record<string, unknown>> = []) {
  return { listSkills: () => skills };
}

describe("SkillSearchEngine", () => {
  test("search returns results matching query", async () => {
    const engine = makeEngine([
      { name: "deploy-app", description: "Deploy the application to production", steps: [], source: "local" },
      { name: "run-tests", description: "Run the test suite", steps: [], source: "local" },
    ]);
    const searcher = new SkillSearchEngine(engine);
    const results = await searcher.search("deploy", "internal");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("deploy-app");
  });

  test("search scores name matches higher", async () => {
    const engine = makeEngine([
      { name: "deploy", description: "something unrelated", steps: [], source: "local" },
      { name: "other", description: "deploy the application quickly", steps: [], source: "local" },
    ]);
    const searcher = new SkillSearchEngine(engine);
    const results = await searcher.search("deploy", "internal");
    expect(results[0].name).toBe("deploy");
  });

  test("handles empty query with score > 0 from exact match", async () => {
    const engine = makeEngine([
      { name: "test", description: "a test skill", steps: [], source: "local" },
    ]);
    const searcher = new SkillSearchEngine(engine);
    const results = await searcher.search("", "internal");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBe(8);
  });

  test("handles no skills", async () => {
    const engine = makeEngine([]);
    const searcher = new SkillSearchEngine(engine);
    const results = await searcher.search("anything", "internal");
    expect(results).toEqual([]);
  });

  test("search respects k limit", async () => {
    const skills = Array.from({ length: 10 }, (_, i) => ({
      name: `skill-${i}`,
      description: `skill number ${i} deploy things`,
      steps: [],
      source: "local",
    }));
    const engine = makeEngine(skills);
    const searcher = new SkillSearchEngine(engine);
    const results = await searcher.search("deploy", "internal", 3);
    expect(results.length).toBe(3);
  });
});
