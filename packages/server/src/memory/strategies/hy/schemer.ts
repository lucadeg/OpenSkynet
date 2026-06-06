import type { MemoryTarget, MemoryType } from "../../../core/types";

const PROCEDURE_KEYWORDS = [
  "step", "steps", "how to", "first", "then", "next", "finally",
  "instructions", "guide", "tutorial", "process", "method",
];

const PREFERENCE_KEYWORDS = [
  "like", "love", "hate", "dislike", "prefer", "favorite", "favourite",
  "always", "never", "best", "worst", "enjoy",
];

const EPISODIC_KEYWORDS = [
  "yesterday", "last week", "last time", "earlier", "ago", "before",
  "remember when", "that time", "i went", "i did", "i tried",
];

const USER_PATTERNS = [
  /(?:i |my |me |i'm |i am )/i,
  /(?:my name|i live|i work|i have a)/i,
  /(?:please|can you|could you)/i,
];

export class Schemer {
  categorize(content: string): { type: MemoryType; target: MemoryTarget } {
    const lower = content.toLowerCase();
    let type: MemoryType = "fact";

    if (PROCEDURE_KEYWORDS.some((k) => lower.includes(k))) {
      type = "procedure";
    } else if (PREFERENCE_KEYWORDS.some((k) => lower.includes(k))) {
      type = "preference";
    } else if (EPISODIC_KEYWORDS.some((k) => lower.includes(k))) {
      type = "episodic";
    }

    const target: MemoryTarget = USER_PATTERNS.some((p) => p.test(content))
      ? "user"
      : "memory";

    return { type, target };
  }

  extractEntities(content: string): string[] {
    const entities = new Set<string>();
    const capitalized = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalized) {
      for (const match of capitalized) {
        entities.add(match);
      }
    }
    const quoted = content.match(/"([^"]+)"/g);
    if (quoted) {
      for (const match of quoted) {
        entities.add(match.replace(/"/g, ""));
      }
    }
    return Array.from(entities);
  }
}
