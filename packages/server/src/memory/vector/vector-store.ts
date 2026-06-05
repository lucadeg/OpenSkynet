import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { computeEmbedding } from "./embeddings";
import { getConfig } from "../../core/config";
import { getDb } from "../../store/db";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS vector_store (
    id TEXT PRIMARY KEY,
    embedding TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
);
`;

let _ensured = false;

function ensureTable(db: Database): void {
  if (_ensured) return;
  db.exec(CREATE_TABLE);
  _ensured = true;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface VectorEntry {
  id: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export class VectorStore {
  private db: Database;

  constructor(dbPath?: string) {
    if (dbPath) {
      mkdirSync(dirname(dbPath), { recursive: true });
      this.db = new Database(dbPath, { create: true });
      this.db.exec("PRAGMA journal_mode=WAL");
    } else {
      this.db = getDb();
    }
    ensureTable(this.db);
  }

  add(
    id: string,
    embedding: number[],
    metadata: Record<string, unknown>,
  ): void {
    this.db
      .query(
        "INSERT OR REPLACE INTO vector_store (id, embedding, metadata) VALUES (?, ?, ?)",
      )
      .run(id, JSON.stringify(embedding), JSON.stringify(metadata));
  }

  addText(
    id: string,
    text: string,
    metadata: Record<string, unknown>,
  ): void {
    this.add(id, computeEmbedding(text), metadata);
  }

  search(
    queryEmbedding: number[],
    limit = 10,
  ): VectorSearchResult[] {
    const rows = this.db
      .query("SELECT id, embedding, metadata FROM vector_store")
      .all() as Array<{ id: string; embedding: string; metadata: string }>;

    const scored: VectorSearchResult[] = [];
    for (const row of rows) {
      const emb = JSON.parse(row.embedding) as number[];
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < emb.length; i++) {
        dot += emb[i] * queryEmbedding[i];
        normA += emb[i] * emb[i];
        normB += queryEmbedding[i] * queryEmbedding[i];
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      const score = denom === 0 ? 0 : dot / denom;

      scored.push({
        id: row.id,
        score,
        metadata: JSON.parse(row.metadata),
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  searchByText(text: string, limit = 10): VectorSearchResult[] {
    return this.search(computeEmbedding(text), limit);
  }

  remove(id: string): boolean {
    const result = this.db
      .query("DELETE FROM vector_store WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  get(id: string): VectorEntry | null {
    const row = this.db
      .query("SELECT id, embedding, metadata FROM vector_store WHERE id = ?")
      .get(id) as { id: string; embedding: string; metadata: string } | null;

    if (!row) return null;
    return {
      id: row.id,
      embedding: JSON.parse(row.embedding),
      metadata: JSON.parse(row.metadata),
    };
  }

  count(): number {
    const row = this.db
      .query("SELECT COUNT(*) as cnt FROM vector_store")
      .get() as { cnt: number };
    return row.cnt;
  }
}
