import { describe, test, expect } from "bun:test";
import { TUIConfig } from "./config.js";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

describe("TUIConfig", () => {
  const tmpDir = join(process.cwd(), ".tmp-config-test");
  const tmpFile = join(tmpDir, "tui-config.json");

  test("load returns defaults when no config file", () => {
    const config = TUIConfig.load();
    expect(config).toBeDefined();
    expect(config.theme).toBeDefined();
  });

  test("save and load round-trip", () => {
    const config = new TUIConfig({ theme: "dracula", provider: "anthropic", model: "claude-3", baseUrl: "http://localhost:1234" });
    config.save();
    const loaded = TUIConfig.load();
    expect(loaded.theme).toBe("dracula");
    expect(loaded.provider).toBe("anthropic");
    expect(loaded.model).toBe("claude-3");
    expect(loaded.baseUrl).toBe("http://localhost:1234");

    new TUIConfig({ theme: "opencode", provider: "openai", model: "", baseUrl: "" }).save();
  });
});
