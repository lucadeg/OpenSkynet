import { randomUUID } from "node:crypto";
import type { MemoryEntry, MemoryTarget, MemoryType } from "../../../core/types";
import { getConfig } from "../../../core/config";
import logger from "../../../core/logging";
// import { computeEmbedding } from "../../vector/embeddings"; // Commented out - module removed
import { BaseMemoryStrategy } from "../../strategy";
import type { HyMemoryStats } from "./models";
import { HyMemoryStore } from "./store";
import { MemoryExtractor } from "./extractor";
import { MemoryGate } from "./gate";

// Stub function for computeEmbedding until vector module is restored
function computeEmbedding(_text: string): number[] {
  // Return a dummy embedding vector of zeros
  return new Array(1536).fill(0); // Standard OpenAI embedding size
}
import { Schemer } from "./schemer";
import { Retriever } from "./retriever";
import { Merger } from "./merger";
import { Evolver } from "./evolver";
import { Chain } from "./chain";
import { ConsolidationWorker } from "./worker";

export class HyMemoryStrategy extends BaseMemoryStrategy {
  private store!: HyMemoryStore;
  private chain!: Chain;
  private worker!: ConsolidationWorker;
  private retriever!: Retriever;
  private initialized = false;

  static override name(): string {
    return "hy";
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const config = getConfig();
    this.store = new HyMemoryStore(config.hyMemoryDb);

    const extractor = new MemoryExtractor();
    const gate = new MemoryGate();
    const schemer = new Schemer();
    this.retriever = new Retriever(this.store);
    const merger = new Merger();
    const evolver = new Evolver();

    this.chain = new Chain(this.store, extractor, gate, this.retriever);
    this.worker = new ConsolidationWorker(this.store, evolver, merger);

    this.initialized = true;
    logger.info("hy memory strategy initialized");
  }

  write(
    target: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): boolean {
    const schemer = new Schemer();
    const { type } = schemer.categorize(content);
    const now = new Date().toISOString();

    const record = {
      id: (metadata?.id as string) ?? randomUUID(),
      content: content.trim(),
      target,
      type,
      source: (metadata?.source as string) ?? "direct",
      embedding: computeEmbedding(content),
      createdAt: now,
      accessedAt: now,
      accessCount: 0,
      importance: (metadata?.importance as number) ?? 0.5,
      connections: (metadata?.connections as string[]) ?? [],
    };

    this.store.add(record);
    return true;
  }

  search(query: string, limit = 10): MemoryEntry[] {
    const results = this.retriever.retrieve(query, limit);
    return results.map((r) => ({
      id: r.id,
      content: r.content,
      target: r.target as MemoryTarget,
      type: r.type as MemoryType,
      source: r.source,
      created_at: r.createdAt,
      score: r.score,
    }));
  }

  replace(
    target: string,
    oldContent: string,
    newContent: string,
  ): boolean {
    const all = this.store.getAll(target);
    const match = all.find((r) => r.content === oldContent.trim());
    if (!match) return false;

    return this.store.update(match.id, {
      content: newContent.trim(),
      embedding: computeEmbedding(newContent),
    });
  }

  remove(target: string, content: string): boolean {
    const all = this.store.getAll(target);
    const match = all.find((r) => r.content === content.trim());
    if (!match) return false;
    return this.store.remove(match.id);
  }

  context(task: string, maxChars = 4000): string {
    const results = this.retriever.retrieve(task, 50);

    const sections: Record<string, string[]> = {};
    let totalChars = 0;

    for (const r of results) {
      if (totalChars + r.content.length > maxChars) break;
      const section = r.target;
      sections[section] ??= [];
      sections[section].push(`- ${r.content}`);
      totalChars += r.content.length + 2;
    }

    const parts: string[] = [];
    if (sections.memory?.length) {
      parts.push("## Memory\n" + sections.memory.join("\n"));
    }
    if (sections.user?.length) {
      parts.push("## User\n" + sections.user.join("\n"));
    }
    return parts.join("\n\n");
  }

  getStats(): HyMemoryStats {
    return this.store.getStats();
  }

  override async review(
    conversation: Array<{ role: string; content: string }>,
  ): Promise<Array<Record<string, unknown>>> {
    const extractor = new MemoryExtractor();
    const extracted = extractor.extractFromConversation(conversation);
    return extracted.map((e) => ({
      content: e.content,
      type: e.type,
      importance: e.importance,
    }));
  }

  override shouldReview(turnCount: number): boolean {
    return turnCount > 0 && turnCount % 3 === 0;
  }
}
