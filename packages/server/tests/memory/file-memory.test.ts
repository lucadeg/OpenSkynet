import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { tmpSedimanDir } from "../fixtures";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resetConfig } from "../../src/core/config";

describe("FileMemoryStrategy", () => {
  let dir: string;
  let cleanup: () => void;
  let mem: import("../../src/memory/strategies/file-memory").FileMemoryStrategy;
  let memDir: string;

  beforeEach(async () => {
    ({ dir, cleanup } = tmpSedimanDir());
    process.env.SEDIMAN_DATA_DIR = dir;
    resetConfig();
    const mod = await import("../../src/memory/strategies/file-memory");
    mem = new mod.FileMemoryStrategy();
    memDir = dir + "/memories";
    await mem.initialize();

    writeFileSync(join(memDir, "MEMORY.md"), "- The project uses TypeScript\n- We deploy on Fridays\n");
    writeFileSync(join(memDir, "USER.md"), "- prefers dark mode\n");
  });

  afterEach(() => {
    cleanup();
    delete process.env.SEDIMAN_DATA_DIR;
    resetConfig();
  });

  test("write returns true", () => {
    const result = mem.write("memory", "A new fact");
    expect(result).toBe(true);
  });

  test("search finds entries by keyword", () => {
    const results = mem.search("TypeScript");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain("TypeScript");
  });

  test("replace modifies entries", () => {
    const replaced = mem.replace("memory", "The project uses TypeScript", "The project uses Python");
    expect(replaced).toBe(true);
    const data = readFileSync(join(memDir, "MEMORY.md"), "utf-8");
    expect(data).toContain("Python");
    expect(data).not.toContain("TypeScript");
  });

  test("remove deletes entries", () => {
    const removed = mem.remove("memory", "We deploy on Fridays");
    expect(removed).toBe(true);
    const data = readFileSync(join(memDir, "MEMORY.md"), "utf-8");
    expect(data).not.toContain("We deploy on Fridays");
  });

  test("context returns formatted text", () => {
    const ctx = mem.context("TypeScript project");
    expect(typeof ctx).toBe("string");
    expect(ctx.length).toBeGreaterThan(0);
  });
});
