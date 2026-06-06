import { Database } from "bun:sqlite";
import { getConfig } from "../../core/config";
import logger from "../../core/logging";
import type { SearchResult } from "../base";

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS search_results (
    query TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    snippet TEXT NOT NULL,
    score REAL NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

const INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_search_results_query ON search_results(query);
`;

export class SQLiteSearchStorage {
  private db: Database;

  constructor(db?: Database) {
    this.db = db ?? this.openDefault();
    this.db.exec(TABLE_DDL);
    this.db.exec(INDEX_DDL);
  }

  save(query: string, results: SearchResult[]): void {
    const insert = this.db.prepare(
      "INSERT INTO search_results (query, title, url, snippet, score, source) VALUES (?, ?, ?, ?, ?, ?)",
    );

    this.db.transaction(() => {
      for (const r of results) {
        insert.run(query, r.title, r.url ?? null, r.snippet, r.score, r.source);
      }
    })();
  }

  load(query: string): SearchResult[] | null {
    const stmt = this.db.prepare(
      "SELECT title, url, snippet, score, source FROM search_results WHERE query = ? ORDER BY score DESC",
    );
    const rows = stmt.all(query) as Array<{
      title: string;
      url: string | null;
      snippet: string;
      score: number;
      source: string;
    }>;

    if (rows.length === 0) return null;

    return rows.map((row) => ({
      title: row.title,
      ...(row.url ? { url: row.url } : {}),
      snippet: row.snippet,
      score: row.score,
      source: row.source,
    }));
  }

  private openDefault(): Database {
    const config = getConfig();
    return new Database(config.dbPath, { create: true });
  }
}
