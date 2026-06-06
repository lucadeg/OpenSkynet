import type { MemoryType } from "../../../core/types";

const TRIVIAL_PATTERNS = [
  /^(?:ok|yes|no|sure|thanks|thank you|hi|hello|bye|goodbye)\.?$/i,
  /^\s*$/,
  /^(?:lol|hmm|haha|oh|yeah|nope)\s*$/i,
];

const LOW_VALUE_PATTERNS = [
  /(?:i don'?t know|maybe|perhaps|whatever|i guess)/i,
  /^(?:ok|alright|sure|fine)\s*$/i,
];

export class MemoryGate {
  shouldStore(content: string, type: MemoryType): boolean {
    const trimmed = content.trim();
    if (trimmed.length < 10) return false;
    if (TRIVIAL_PATTERNS.some((p) => p.test(trimmed))) return false;
    if (type === "fact" && LOW_VALUE_PATTERNS.some((p) => p.test(trimmed))) return false;
    return true;
  }

  getImportance(content: string, type: MemoryType): number {
    const base: Record<string, number> = {
      preference: 0.8,
      procedure: 0.7,
      fact: 0.6,
      episodic: 0.5,
    };
    let score = base[type] ?? 0.5;

    if (/\b(?:important|critical|essential|must|always|never)\b/i.test(content)) {
      score += 0.15;
    }
    if (/\b(?:maybe|perhaps|sometimes|might|could)\b/i.test(content)) {
      score -= 0.1;
    }
    const words = content.split(/\s+/).length;
    if (words > 20) score += 0.05;
    if (words < 5) score -= 0.1;

    return Math.max(0.1, Math.min(1.0, score));
  }
}
