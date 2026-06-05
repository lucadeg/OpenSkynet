import { randomUUID } from "node:crypto";
import type { MemoryEntry, MemoryTarget, MemoryType } from "../core/types";
import { MemoryError } from "../core/errors";
import { getConfig } from "../core/config";
import { getDb } from "../store/db";
import logger from "../core/logging";

const CREATE_MEMORY_TABLE = `
CREATE TABLE IF NOT EXISTS memory_entries (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    target TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'fact',
    source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_target ON memory_entries(target);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type);
`;

let _ensured = false;

function ensureTable(): void {
  if (_ensured) return;
  const db = getDb();
  db.exec(CREATE_MEMORY_TABLE);
  _ensured = true;
}

export async function getAllEntries(): Promise<{
  memory: string;
  user: string;
  entries: MemoryEntry[];
}> {
  ensureTable();
  const db = getDb();
  const config = getConfig();

  const entries: MemoryEntry[] = [];
  const rows = db
    .query(
      "SELECT id, content, target, type, source, created_at, updated_at FROM memory_entries ORDER BY created_at DESC",
    )
    .all() as Array<{
    id: string;
    content: string;
    target: string;
    type: string;
    source: string | null;
    created_at: string;
    updated_at: string;
  }>;

  for (const row of rows) {
    entries.push({
      id: row.id,
      content: row.content,
      target: row.target as MemoryTarget,
      type: row.type as MemoryType,
      source: row.source ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  const memoryParts = entries
    .filter((e) => e.target === "memory")
    .map((e) => `- ${e.content}`)
    .join("\n");
  const userParts = entries
    .filter((e) => e.target === "user")
    .map((e) => `- ${e.content}`)
    .join("\n");

  return { memory: memoryParts, user: userParts, entries };
}

export async function addEntry(
  target: string,
  content: string,
  type: MemoryType = "fact",
  source?: string,
): Promise<{ success: boolean; message: string }> {
  ensureTable();
  const db = getDb();
  const config = getConfig();

  const count = (
    db
      .query("SELECT COUNT(*) as cnt FROM memory_entries WHERE target = ?")
      .get(target) as { cnt: number }
  ).cnt;

  if (count >= config.maxEntriesPerType) {
    return {
      success: false,
      message: `Memory limit reached for ${target} (${config.maxEntriesPerType})`,
    };
  }

  const existing = db
    .query("SELECT id FROM memory_entries WHERE target = ? AND content = ?")
    .get(target, content);
  if (existing) {
    return { success: false, message: "Entry already exists" };
  }

  const id = randomUUID();
  db.run(
    "INSERT INTO memory_entries (id, content, target, type, source) VALUES (?, ?, ?, ?, ?)",
    [id, content.trim(), target, type, source ?? null],
  );

  logger.info({ id, target, type }, "memory entry added");
  return { success: true, message: `Added to ${target} memory` };
}

export async function replaceEntry(
  target: string,
  oldContent: string,
  newContent: string,
): Promise<{ success: boolean; message: string }> {
  ensureTable();
  const db = getDb();

  const row = db
    .query(
      "SELECT id FROM memory_entries WHERE target = ? AND content = ?",
    )
    .get(target, oldContent) as { id: string } | null;

  if (!row) {
    return { success: false, message: "Entry not found" };
  }

  db.run(
    "UPDATE memory_entries SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [newContent.trim(), row.id],
  );

  logger.info({ id: row.id, target }, "memory entry replaced");
  return { success: true, message: `Updated entry in ${target} memory` };
}

export async function removeEntry(
  target: string,
  content: string,
): Promise<{ success: boolean; message: string }> {
  ensureTable();
  const db = getDb();

  const row = db
    .query(
      "SELECT id FROM memory_entries WHERE target = ? AND content = ?",
    )
    .get(target, content) as { id: string } | null;

  if (!row) {
    return { success: false, message: "Entry not found" };
  }

  db.run("DELETE FROM memory_entries WHERE id = ?", [row.id]);

  logger.info({ id: row.id, target }, "memory entry removed");
  return { success: true, message: `Removed from ${target} memory` };
}

export async function searchEntries(
  query: string,
  limit = 10,
): Promise<MemoryEntry[]> {
  ensureTable();
  const db = getDb();

  const rows = db
    .query(
      "SELECT id, content, target, type, source, created_at, updated_at FROM memory_entries WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
    )
    .all(`%${query}%`, limit) as Array<{
    id: string;
    content: string;
    target: string;
    type: string;
    source: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    target: row.target as MemoryTarget,
    type: row.type as MemoryType,
    source: row.source ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    score: 1,
  }));
}
