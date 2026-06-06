import type { MemoryType } from "../../../core/types";

const FACT_PATTERNS = [
  /(?:i am|i'm|i have|my name is|my (.+?) is)\s+/i,
  /(?:the|this|that)\s+\w+\s+(?:is|are|was|were|has|have)\s+/i,
  /(?:it|he|she|they)\s+(?:is|are|was|were|has|have|will|can|should)\s+/i,
  /(?:always|never|usually|often|sometimes)\s+/i,
];

const PROCEDURE_PATTERNS = [
  /(?:how to|steps? to|way to|first.*then|to do this)/i,
  /(?:^\d+[\.\)]\s|step \d+)/m,
  /(?:you (?:can|should|need to|must)|make sure to)/i,
];

const PREFERENCE_PATTERNS = [
  /(?:i (?:like|love|hate|dislike|prefer|enjoy|want|don't want|don't like))/i,
  /(?:my favorite|my preferred|i'd rather)/i,
  /(?:please (?:always|never|use|avoid))/i,
];

const EPISODIC_PATTERNS = [
  /(?:yesterday|last (?:week|month|time)|earlier|ago|before)/i,
  /(?:i (?:went|did|tried|saw|visited|used|ran))/i,
  /(?:remember when|that time when)/i,
];

interface Message {
  role: string;
  content: string;
}

interface ExtractedMemory {
  content: string;
  type: MemoryType;
  importance: number;
}

export class MemoryExtractor {
  extractFromConversation(messages: Message[]): ExtractedMemory[] {
    const results: ExtractedMemory[] = [];

    for (const msg of messages) {
      if (msg.role !== "user" && msg.role !== "assistant") continue;
      const sentences = msg.content.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        const type = this.classifyType(trimmed);
        if (type) {
          results.push({
            content: trimmed,
            type,
            importance: this.computeImportance(trimmed, type),
          });
        }
      }
    }

    return results;
  }

  private classifyType(text: string): MemoryType | null {
    if (PREFERENCE_PATTERNS.some((p) => p.test(text))) return "preference";
    if (PROCEDURE_PATTERNS.some((p) => p.test(text))) return "procedure";
    if (EPISODIC_PATTERNS.some((p) => p.test(text))) return "episodic";
    if (FACT_PATTERNS.some((p) => p.test(text))) return "fact";
    return null;
  }

  private computeImportance(text: string, type: MemoryType): number {
    let score = 0.3;
    if (type === "preference") score = 0.8;
    else if (type === "procedure") score = 0.7;
    else if (type === "episodic") score = 0.5;
    else if (type === "fact") score = 0.6;

    if (text.includes("important") || text.includes("critical") || text.includes("must")) {
      score += 0.2;
    }
    if (text.split(/\s+/).length > 15) score += 0.1;

    return Math.min(score, 1.0);
  }
}
