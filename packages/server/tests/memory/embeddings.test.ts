import { test, describe, expect } from "bun:test";
import { computeEmbedding, cosineSimilarity, computeSimilarity } from "../../src/memory/vector/embeddings";

describe("embeddings", () => {
  test("computeEmbedding returns number array of correct length", () => {
    const vec = computeEmbedding("hello world test");
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.length).toBe(4096);
    for (const v of vec) {
      expect(typeof v).toBe("number");
    }
  });

  test("computeEmbedding returns zero vector for empty input", () => {
    const vec = computeEmbedding("");
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  test("cosineSimilarity returns 1 for identical vectors", () => {
    const vec = computeEmbedding("the quick brown fox jumps over the lazy dog");
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
  });

  test("cosineSimilarity returns 0 for orthogonal vectors", () => {
    const a = new Array(4096).fill(0);
    const b = new Array(4096).fill(0);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  test("cosineSimilarity returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  test("computeSimilarity returns number between 0 and 1 for similar text", () => {
    const score = computeSimilarity("hello world", "hello world");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeCloseTo(1.0, 5);
  });

  test("computeSimilarity is higher for similar texts than dissimilar", () => {
    const similar = computeSimilarity("deploy the application to production", "deploy the application to staging");
    const dissimilar = computeSimilarity("deploy the application to production", "the cat sat on the mat");
    expect(similar).toBeGreaterThan(dissimilar);
  });
});
