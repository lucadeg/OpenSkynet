import { test, describe, expect } from "bun:test";
import { isStealthAvailable, buildStealthLaunchArgs } from "../../src/browser/stealth";

describe("isStealthAvailable", () => {
  test("returns a boolean", () => {
    const result = isStealthAvailable();
    expect(typeof result).toBe("boolean");
  });

  test("returns true", () => {
    expect(isStealthAvailable()).toBe(true);
  });
});

describe("buildStealthLaunchArgs", () => {
  test("returns array of strings", () => {
    const args = buildStealthLaunchArgs({ headless: false });
    expect(Array.isArray(args)).toBe(true);
    for (const arg of args) {
      expect(typeof arg).toBe("string");
    }
  });

  test("includes required stealth flags", () => {
    const args = buildStealthLaunchArgs({ headless: false });
    expect(args).toContain("--disable-blink-features=AutomationControlled");
    expect(args).toContain("--disable-infobars");
    expect(args).toContain("--no-first-run");
    expect(args).toContain("--disable-extensions");
  });

  test("includes headless flag when headless is true", () => {
    const args = buildStealthLaunchArgs({ headless: true });
    expect(args).toContain("--headless=new");
  });

  test("omits headless flag when headless is false", () => {
    const args = buildStealthLaunchArgs({ headless: false });
    expect(args).not.toContain("--headless=new");
  });

  test("includes proxy flag when proxy is provided", () => {
    const args = buildStealthLaunchArgs({ headless: false, proxy: "http://localhost:8080" });
    expect(args).toContain("--proxy-server=http://localhost:8080");
  });

  test("omits proxy flag when no proxy provided", () => {
    const args = buildStealthLaunchArgs({ headless: false });
    expect(args.some((a) => a.startsWith("--proxy-server="))).toBe(false);
  });
});
