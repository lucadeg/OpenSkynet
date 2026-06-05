import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { tmpSedimanDir } from "../fixtures";
import { resetConfig } from "../../src/core/config";

describe("auth", () => {
  let dir: string;
  let cleanup: () => void;
  let auth: typeof import("../../src/core/auth");

  beforeEach(async () => {
    ({ dir, cleanup } = tmpSedimanDir());
    process.env.SEDIMAN_DATA_DIR = dir;
    resetConfig();
    auth = await import("../../src/core/auth");
    await auth.writeStore({});
  });

  afterEach(() => {
    cleanup();
    delete process.env.SEDIMAN_DATA_DIR;
    resetConfig();
  });

  test("setKey and getKey work", async () => {
    await auth.setKey("openai", "sk-test-123");
    const key = await auth.getKey("openai");
    expect(key).toBe("sk-test-123");
  });

  test("getKey returns null for unknown provider", async () => {
    const key = await auth.getKey("nonexistent");
    expect(key).toBeNull();
  });

  test("removeKey works", async () => {
    await auth.setKey("openai", "sk-test");
    const removed = await auth.removeKey("openai");
    expect(removed).toBe(true);
    const key = await auth.getKey("openai");
    expect(key).toBeNull();
  });

  test("removeKey returns false for missing key", async () => {
    const removed = await auth.removeKey("nonexistent");
    expect(removed).toBe(false);
  });

  test("listKeys returns all entries", async () => {
    await auth.setKey("openai", "sk-openai");
    await auth.setKey("anthropic", "sk-ant");
    const keys = await auth.listKeys();
    expect(Object.keys(keys).length).toBe(2);
    expect(keys.openai.key).toBe("sk-openai");
    expect(keys.anthropic.key).toBe("sk-ant");
  });

  test("handles corrupted file", async () => {
    const { writeFileSync } = await import("node:fs");
    const { getConfig } = await import("../../src/core/config");
    writeFileSync(getConfig().authFile, "NOT VALID JSON{{{{");
    const store = await auth.readStore();
    expect(store).toEqual({});
  });
});
