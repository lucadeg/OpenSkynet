import type { HyMemoryRecord } from "./models";

export class Summarizer {
  summarize(records: HyMemoryRecord[]): string {
    if (records.length === 0) return "";
    const sorted = [...records].sort((a, b) => b.importance - a.importance);
    const selected = sorted.slice(0, Math.min(5, sorted.length));
    return selected.map((r) => `- ${r.content}`).join("\n");
  }

  consolidateTopic(records: HyMemoryRecord[]): string {
    if (records.length === 0) return "";
    if (records.length === 1) return records[0].content;

    const sorted = [...records].sort((a, b) => b.importance - a.importance);
    const sentences: string[] = [];
    let totalChars = 0;
    const maxChars = 500;

    for (const record of sorted) {
      const parts = record.content.split(/[.!?]+/).filter((s) => s.trim().length > 5);
      for (const part of parts) {
        const trimmed = part.trim();
        if (totalChars + trimmed.length > maxChars) break;
        if (!sentences.some((s) => this.similar(trimmed, s))) {
          sentences.push(trimmed);
          totalChars += trimmed.length;
        }
      }
      if (totalChars >= maxChars) break;
    }

    return sentences.join(". ") + ".";
  }

  private similar(a: string, b: string): boolean {
    const tokensA = new Set(a.toLowerCase().split(/\s+/));
    const tokensB = new Set(b.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) overlap++;
    }
    const jaccard = overlap / (tokensA.size + tokensB.size - overlap);
    return jaccard > 0.6;
  }
}
