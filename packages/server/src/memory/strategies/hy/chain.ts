import { randomUUID } from "node:crypto";
// import { computeEmbedding } from "../../vector/embeddings"; // Commented out - module removed
import type { HyMemoryRecord } from "./models";
import type { HyMemoryStore } from "./store";
import type { MemoryExtractor } from "./extractor";
import type { MemoryGate } from "./gate";
import type { Retriever } from "./retriever";
import { Schemer } from "./schemer";

// Stub function for computeEmbedding until vector module is restored
function computeEmbedding(_text: string): number[] {
  // Return a dummy embedding vector of zeros
  return new Array(1536).fill(0); // Standard OpenAI embedding size
}

export class Chain {
  private store: HyMemoryStore;
  private extractor: MemoryExtractor;
  private gate: MemoryGate;
  private retriever: Retriever;
  private schemer: Schemer;

  constructor(
    store: HyMemoryStore,
    extractor: MemoryExtractor,
    gate: MemoryGate,
    retriever: Retriever,
  ) {
    this.store = store;
    this.extractor = extractor;
    this.gate = gate;
    this.retriever = retriever;
    this.schemer = new Schemer();
  }

  processInput(text: string): {
    stored: HyMemoryRecord[];
    recalled: Array<HyMemoryRecord & { score: number }>;
  } {
    const recalled = this.retriever.retrieve(text, 5);
    const extracted = this.extractor.extractFromConversation([
      { role: "user", content: text },
    ]);

    const stored: HyMemoryRecord[] = [];
    const now = new Date().toISOString();

    for (const mem of extracted) {
      if (!this.gate.shouldStore(mem.content, mem.type)) continue;

      const { type, target } = this.schemer.categorize(mem.content);
      const importance = this.gate.getImportance(mem.content, type);
      const embedding = computeEmbedding(mem.content);

      const record: HyMemoryRecord = {
        id: randomUUID(),
        content: mem.content,
        target,
        type,
        source: "conversation",
        embedding,
        createdAt: now,
        accessedAt: now,
        accessCount: 0,
        importance,
        connections: [],
      };

      this.store.add(record);
      stored.push(record);
    }

    for (const r of recalled) {
      this.store.update(r.id, {
        accessedAt: now,
        accessCount: r.accessCount + 1,
      });
    }

    return { stored, recalled };
  }
}
