import { test, describe, expect } from "bun:test";
import { ArtifactStore } from "../../../src/agent/subagents/artifact";
import type { Artifact } from "../../../src/agent/subagents/artifact";

describe("ArtifactStore", () => {
  test("add and get artifacts for a session", () => {
    const store = new ArtifactStore();
    const artifact: Artifact = { type: "text", name: "output", content: "hello" };
    store.add("session-1", artifact);
    const result = store.get("session-1");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("output");
    expect(result[0].content).toBe("hello");
  });

  test("get returns empty array for unknown session", () => {
    const store = new ArtifactStore();
    expect(store.get("unknown")).toEqual([]);
  });

  test("add multiple artifacts to same session", () => {
    const store = new ArtifactStore();
    store.add("s1", { type: "file", name: "a", content: "1" });
    store.add("s1", { type: "url", name: "b", content: "https://example.com" });
    expect(store.get("s1").length).toBe(2);
  });

  test("clear removes all artifacts for a session", () => {
    const store = new ArtifactStore();
    store.add("s1", { type: "text", name: "a", content: "data" });
    store.add("s2", { type: "text", name: "b", content: "data2" });
    store.clear("s1");
    expect(store.get("s1")).toEqual([]);
    expect(store.get("s2").length).toBe(1);
  });

  test("clear non-existent session does not throw", () => {
    const store = new ArtifactStore();
    expect(() => store.clear("nonexistent")).not.toThrow();
  });
});
