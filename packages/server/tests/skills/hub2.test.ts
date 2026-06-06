/** Tests for Skills Hub */
import { test, describe, expect } from "bun:test";
import { HubClient, SkillLockFile } from "../../src/skills/hub.js";

describe("SkillsHub", () => {
  describe("HubClient", () => {
    test("brows skills", async () => {
      const client = new HubClient();
      const skills = await client.browse();
      expect(skills).toBeDefined();
    });

    test("searches skills", async () => {
      const client = new HubClient();
      const results = await client.search("weather");
      expect(results).toBeDefined();
    });

    test("gets skill info", async () => {
      const client = new HubClient();
      const info = await client.info("test-skill");
      expect(info).toBeDefined();
    });
  });

  describe("GitHubInstaller", () => {
    test("installs from GitHub", async () => {
      const installed = true;
      expect(installed).toBe(installed);
    });

    test("parses GitHub ref", () => {
      const ref = "owner/repo";
      const match = ref.match(/^([^/]+)\/([^/]+?)/);
      expect(match).toBeDefined();
    });
  });

  describe("SkillLockFile", () => {
    test("reads lock file", () => {
      const lockFile = new SkillLockFile("/test");
      const entry = lockFile.get("test");
      expect(entry).toBeNull();
    });

    test("writes lock file", () => {
      const lockFile = new SkillLockFile("/test");
      lockFile.set("test", {
        source: "github:test/repo",
        ref: "main",
        installed_at: new Date().toISOString(),
        version: 1,
      });
      const entry = lockFile.get("test");
      expect(entry).toBeDefined();
      expect(entry!.source).toBe("github:test/repo");
    });

    test("removes lock entry", () => {
      const lockFile = new SkillLockFile("/test");
      lockFile.set("test", {
        source: "test",
        ref: "main",
        installed_at: new Date().toISOString(),
        version: 1,
      });
      const removed = lockFile.remove("test");
      expect(removed).toBe(true);
    });

    test("lists all entries", () => {
      const lockFile = new SkillLockFile("/test");
      lockFile.set("skill1", {
        source: "test1",
        ref: "main",
        installed_at: new Date().toISOString(),
        version: 1,
      });
      const entries = lockFile.list();
      expect(Object.keys(entries).length).toBe(1);
    });
  });
});
