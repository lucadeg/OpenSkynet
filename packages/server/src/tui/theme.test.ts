import { describe, test, expect } from "bun:test";
import { THEMES, getTheme, type ThemeTokens } from "./theme.js";

describe("theme", () => {
  test("THEMES has 9 entries", () => {
    expect(THEMES.length).toBe(9);
  });

  test("each theme has all 15 tokens + name", () => {
    const tokens: Array<keyof ThemeTokens> = [
      "background", "backgroundPanel", "backgroundElement",
      "text", "textMuted", "primary", "secondary",
      "success", "error", "warning", "info",
      "border", "borderActive", "diffAdded", "diffRemoved",
    ];
    for (const theme of THEMES) {
      expect(theme.name).toBeTruthy();
      for (const token of tokens) {
        expect(theme[token]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  test("getTheme returns opencode by default", () => {
    const theme = getTheme("opencode");
    expect(theme.primary).toBe("#fab283");
    expect(theme.background).toBe("#0a0a0a");
  });

  test("getTheme falls back to first theme for unknown name", () => {
    const theme = getTheme("nonexistent");
    expect(theme).toEqual(THEMES[0]);
  });

  test("all theme names are unique", () => {
    const names = THEMES.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("known themes exist", () => {
    const names = THEMES.map(t => t.name);
    expect(names).toContain("opencode");
    expect(names).toContain("tokyo-night");
    expect(names).toContain("dracula");
    expect(names).toContain("nord");
    expect(names).toContain("gruvbox");
    expect(names).toContain("rose-pine");
    expect(names).toContain("solarized");
    expect(names).toContain("catppuccin");
    expect(names).toContain("default");
  });
});
