import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getConfig } from "../../../core/config";
import { cosineSimilarity } from "../../vector/embeddings";
import type { HyMemoryRecord, HyMemoryStats } from "./models";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS hy_memory (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  embedding TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  accessedAt TEXT NOT NULL,
  accessCount INTEGER NOT NULL DEFAULT 0,
  importance REAL NOT NULL DEFAULT 0.5,
  connections TEXT NOT NULL DEFAULT '[]'
);
`;

export class HyMemoryStore {
  private db: Database;

  constructor(dbPath?: string) {
    const path = dbPath ?? getConfig().hyMemoryDb;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec(CREATE_TABLE);
  }

  add(record: HyMemoryRecord): void {
    this.db
      .query(
        `INSERT OR REPLACE INTO hy_memory
         (id, content, target, type, source, embedding, createdAt, accessedAt, accessCount, importance, connections)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.content,
        record.target,
        record.type,
        record.source,
        JSON.stringify(record.embedding),
        record.createdAt,
        record.accessedAt,
        record.accessCount,
        record.importance,
        JSON.stringify(record.connections),
      );
  }

  get(id: string): HyMemoryRecord | null {
    const row = this.db
      .query("SELECT * FROM hy_memory WHERE id = ?")
      .get(id) as Record<string, unknown> | null;
    return row ? this.rowToRecord(row) : null;
  }

  search(
    queryEmbedding: number[],
    limit = 10,
  ): Array<HyMemoryRecord & { score: number }> {
    const rows = this.db
      .query("SELECT * FROM hy_memory")
      .all() as Record<string, unknown>[];
    const scored: Array<HyMemoryRecord & { score: number }> = [];
    for (const row of rows) {
      const rec = this.rowToRecord(row);
      const score = cosineSimilarity(queryEmbedding, rec.embedding);
      scored.push({ ...rec, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  update(id: string, updates: Partial<HyMemoryRecord>): boolean {
    const existing = this.get(id);
    if (!existing) return false;
    const merged = { ...existing, ...updates };
    this.add(merged);
    return true;
  }

  remove(id: string): boolean {
    const result = this.db
      .query("DELETE FROM hy_memory WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  getAll(target?: string): HyMemoryRecord[] {
    const rows = target
      ? (this.db
          .query("SELECT * FROM hy_memory WHERE target = ?")
          .all(target) as Record<string, unknown>[])
      : (this.db
          .query("SELECT * FROM hy_memory")
          .all() as Record<string, unknown>[]);
    return rows.map((r) => this.rowToRecord(r));
  }

  count(target?: string): number {
    const row = target
      ? (this.db
          .query("SELECT COUNT(*) as cnt FROM hy_memory WHERE target = ?")
          .get(target) as { cnt: number })
      : (this.db
          .query("SELECT COUNT(*) as cnt FROM hy_memory")
          .get() as { cnt: number });
    return row.cnt;
  }

  getStats(): HyMemoryStats {
    const rows = this.db
      .query("SELECT * FROM hy_memory")
      .all() as Record<string, unknown>[];

    const byType: Record<string, number> = {};
    const byTarget: Record<string, number> = {};
    let totalImportance = 0;

    for (const row of rows) {
      const type = row.type as string;
      const target = row.target as string;
      byType[type] = (byType[type] ?? 0) + 1;
      byTarget[target] = (byTarget[target] ?? 0) + 1;
      totalImportance += row.importance as number;
    }

    return {
      totalEntries: rows.length,
      byType,
      byTarget,
      avgImportance: rows.length > 0 ? totalImportance / rows.length : 0,
      lastConsolidation: null,
    };
  }

  clear(): void {
    this.db.exec("DELETE FROM hy_memory");
  }

  private rowToRecord(row: Record<string, unknown>): HyMemoryRecord {
    return {
      id: row.id as string,
      content: row.content as string,
      target: row.target as string,
      type: row.type as string,
      source: row.source as string,
      embedding: JSON.parse(row.embedding as string),
      createdAt: row.createdAt as string,
      accessedAt: row.accessedAt as string,
      accessCount: row.accessCount as number,
      importance: row.importance as number,
      connections: JSON.parse(row.connections as string),
    };
  }
}
