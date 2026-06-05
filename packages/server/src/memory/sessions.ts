import { randomUUID } from "node:crypto";
import type { SessionInfo, StepEvent } from "../core/types";
import { getDb } from "../store/db";
import logger from "../core/logging";

export async function saveSession(session: {
  task: string;
  steps?: StepEvent[];
  result?: string;
}): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const stepsJson = JSON.stringify(session.steps ?? []);

  db.run(
    "INSERT INTO sessions (id, task, steps_json, result) VALUES (?, ?, ?, ?)",
    [id, session.task, stepsJson, session.result ?? null],
  );

  logger.info({ sessionId: id, task: session.task }, "session saved");
  return id;
}

export async function getRecentSessions(
  limit = 20,
): Promise<SessionInfo[]> {
  const db = getDb();
  const rows = db
    .query(
      "SELECT id, task, created_at, result FROM sessions ORDER BY created_at DESC LIMIT ?",
    )
    .all(limit) as Array<{
    id: string;
    task: string;
    created_at: string;
    result: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    task: row.task,
    created_at: row.created_at,
    result: row.result ?? undefined,
  }));
}

export async function searchSessions(
  query: string,
  limit = 10,
): Promise<SessionInfo[]> {
  const db = getDb();
  const rows = db
    .query(
      "SELECT s.id, s.task, s.created_at, s.result FROM sessions s JOIN sessions_fts f ON s.id = f.id WHERE sessions_fts MATCH ? ORDER BY rank LIMIT ?",
    )
    .all(query, limit) as Array<{
    id: string;
    task: string;
    created_at: string;
    result: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    task: row.task,
    created_at: row.created_at,
    result: row.result ?? undefined,
  }));
}

export async function getSessionById(
  id: string,
): Promise<SessionInfo | null> {
  const db = getDb();
  const row = db
    .query(
      "SELECT id, task, created_at, result FROM sessions WHERE id = ?",
    )
    .get(id) as {
    id: string;
    task: string;
    created_at: string;
    result: string | null;
  } | null;

  if (!row) return null;

  return {
    id: row.id,
    task: row.task,
    created_at: row.created_at,
    result: row.result ?? undefined,
  };
}

export async function deleteSession(id: string): Promise<boolean> {
  const db = getDb();
  const result = db.run("DELETE FROM sessions WHERE id = ?", [id]);
  return result.changes > 0;
}
