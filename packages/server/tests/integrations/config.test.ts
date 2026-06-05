import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IntegrationConfig } from "../../src/integrations/config";

let dir: string;
let configPath: string;

describe("IntegrationConfig", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sediman-config-test-"));
    configPath = join(dir, "integrations.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("get returns null for missing integration", () => {
    const cfg = new IntegrationConfig(configPath);
    expect(cfg.get("missing")).toBeNull();
  });

  test("set and get work", () => {
    const cfg = new IntegrationConfig(configPath);
    cfg.set("slack", { token: "xoxb-123", channels: ["general"] });
    const result = cfg.get("slack");
    expect(result).not.toBeNull();
    expect(result!.token).toBe("xoxb-123");
  });

  test("remove deletes entry and returns true", () => {
    const cfg = new IntegrationConfig(configPath);
    cfg.set("slack", { token: "xoxb-123" });
    expect(cfg.remove("slack")).toBe(true);
    expect(cfg.get("slack")).toBeNull();
  });

  test("remove returns false for missing entry", () => {
    const cfg = new IntegrationConfig(configPath);
    expect(cfg.remove("nonexistent")).toBe(false);
  });

  test("list returns all entries", () => {
    const cfg = new IntegrationConfig(configPath);
    cfg.set("slack", { token: "xoxb-1" });
    cfg.set("discord", { token: "discord-1" });
    const all = cfg.list();
    expect(Object.keys(all).length).toBe(2);
    expect(all.slack.token).toBe("xoxb-1");
    expect(all.discord.token).toBe("discord-1");
  });

  test("persists to file", () => {
    const cfg = new IntegrationConfig(configPath);
    cfg.set("slack", { token: "xoxb-persist" });

    expect(existsSync(configPath)).toBe(true);
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.slack.token).toBe("xoxb-persist");

    const cfg2 = new IntegrationConfig(configPath);
    expect(cfg2.get("slack")!.token).toBe("xoxb-persist");
  });
});
