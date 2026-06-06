import { test, describe, expect } from "bun:test";
import {
  OpenAICompatibleProvider,
  createProvider,
  listProviders,
  PROVIDERS,
} from "../../src/llm/provider";

describe("OpenAICompatibleProvider", () => {
  test("constructor sets model", () => {
    const p = new OpenAICompatibleProvider("gpt-4o", "sk-test", "https://api.example.com/v1");
    expect((p as any).model).toBe("gpt-4o");
  });

  test("constructor uses default apiKey", () => {
    const p = new OpenAICompatibleProvider("gpt-4o");
    expect((p as any).model).toBe("gpt-4o");
  });
});

describe("createProvider", () => {
  test("throws for unknown provider", () => {
    expect(() => createProvider("nonexistent_provider_xyz")).toThrow();
  });

  test("creates provider from valid preset", () => {
    const firstKey = Object.keys(PROVIDERS)[0];
    if (firstKey) {
      const p = createProvider(firstKey);
      expect(p).toBeInstanceOf(OpenAICompatibleProvider);
    }
  });
});

describe("listProviders", () => {
  test("returns provider list", () => {
    const providers = listProviders();
    expect(Array.isArray(providers)).toBe(true);
    for (const p of providers) {
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("default_model");
      expect(p).toHaveProperty("category");
    }
  });
});
