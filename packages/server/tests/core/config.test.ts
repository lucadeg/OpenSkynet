import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { homedir } from "node:os";
import { resetConfig, getConfig } from "../../src/core/config";

const ORIGINAL_ENV: Record<string, string | undefined> = {};
const ENV_KEYS = ["SEDIMAN_DATA_DIR", "SEDIMAN_MEMORY_LIMIT", "SEDIMAN_CORS_ORIGINS", "SEDIMAN_STEALTH"];

describe("config", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      ORIGINAL_ENV[key] = process.env[key];
    }
    resetConfig();
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(ORIGINAL_ENV)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    resetConfig();
  });

  test("returns config with correct defaults", () => {
    delete process.env.SEDIMAN_DATA_DIR;
    delete process.env.SEDIMAN_MEMORY_LIMIT;
    const cfg = getConfig();
    expect(cfg.memoryLimit).toBe(2200);
    expect(cfg.userLimit).toBe(1375);
    expect(cfg.maxTaskLength).toBe(10000);
    expect(cfg.maxNameLength).toBe(64);
  });

  test("data dir defaults to ~/.terminator", () => {
    delete process.env.SEDIMAN_DATA_DIR;
    const cfg = getConfig();
    expect(cfg.dataDir).toBe(join(homedir(), ".terminator"));
  });

  test("paths are derived from data dir", () => {
    process.env.SEDIMAN_DATA_DIR = "/tmp/test-sediman-cfg";
    const cfg = getConfig();
    expect(cfg.skillsDir).toBe("/tmp/test-sediman-cfg/skills");
    expect(cfg.memoryDir).toBe("/tmp/test-sediman-cfg/memories");
    expect(cfg.sessionsDir).toBe("/tmp/test-sediman-cfg/sessions");
    expect(cfg.cronDir).toBe("/tmp/test-sediman-cfg/cron");
    expect(cfg.dbPath).toBe("/tmp/test-sediman-cfg/state.db");
    expect(cfg.authFile).toBe("/tmp/test-sediman-cfg/auth.json");
  });

  test("reads env vars correctly", () => {
    process.env.SEDIMAN_DATA_DIR = "/tmp/env-test";
    process.env.SEDIMAN_MEMORY_LIMIT = "5000";
    process.env.SEDIMAN_CORS_ORIGINS = "http://a.com,http://b.com";
    process.env.SEDIMAN_STEALTH = "false";
    const cfg = getConfig();
    expect(cfg.dataDir).toBe("/tmp/env-test");
    expect(cfg.memoryLimit).toBe(5000);
    expect(cfg.corsOrigins).toEqual(["http://a.com", "http://b.com"]);
    expect(cfg.stealthEnabled).toBe(false);
  });

  test("config object is frozen", () => {
    const cfg = getConfig();
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  test("regex patterns are correct", () => {
    const cfg = getConfig();
    expect(cfg.safeNameRe.test("my-skill")).toBe(true);
    expect(cfg.safeNameRe.test("BAD")).toBe(false);
    expect(cfg.safeNameRe.test("../evil")).toBe(false);
  });
});
