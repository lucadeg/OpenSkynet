import { randomUUID } from "node:crypto";
import { getDb } from "../store/db";
import logger from "../core/logging";

export interface TrajectoryStep {
  action: string;
  observation?: string;
  timestamp?: string;
}

export interface Trajectory {
  id: string;
  task: string;
  steps: TrajectoryStep[];
  result?: string;
  success: boolean;
  skillName?: string;
  errorType?: string;
  durationMs?: number;
  screenshotDir?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface TrajectoryPreference {
  trajectoryId: string;
  rating: number;
  feedback?: string;
}

export class TrajectoryDB {
  async save(
    trajectory: Omit<Trajectory, "id" | "createdAt">,
  ): Promise<Trajectory> {
    const db = getDb();
    const id = randomUUID();

    db.run(
      "INSERT INTO trajectories (id, task, steps_json, result, success, skill_name, error_type, duration_ms, screenshot_dir, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        trajectory.task,
        JSON.stringify(trajectory.steps),
        trajectory.result ?? null,
        trajectory.success ? 1 : 0,
        trajectory.skillName ?? null,
        trajectory.errorType ?? null,
        trajectory.durationMs ?? null,
        trajectory.screenshotDir ?? null,
        JSON.stringify(trajectory.metadata ?? {}),
      ],
    );

    logger.info({ trajectoryId: id, task: trajectory.task }, "trajectory saved");
    return { ...trajectory, id, createdAt: new Date().toISOString() };
  }

  async getById(id: string): Promise<Trajectory | null> {
    const db = getDb();
    const row = db
      .query("SELECT * FROM trajectories WHERE id = ?")
      .get(id) as DbRow | null;
    return row ? this.mapRow(row) : null;
  }

  async getByTask(task: string, limit = 20): Promise<Trajectory[]> {
    const db = getDb();
    const rows = db
      .query(
        "SELECT * FROM trajectories WHERE task LIKE ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(`%${task}%`, limit) as DbRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async getBySkillName(
    skillName: string,
    limit = 20,
  ): Promise<Trajectory[]> {
    const db = getDb();
    const rows = db
      .query(
        "SELECT * FROM trajectories WHERE skill_name = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(skillName, limit) as DbRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async getSuccessful(limit = 20): Promise<Trajectory[]> {
    const db = getDb();
    const rows = db
      .query(
        "SELECT * FROM trajectories WHERE success = 1 ORDER BY created_at DESC LIMIT ?",
      )
      .all(limit) as DbRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async addPreference(
    trajectoryId: string,
    rating: number,
    feedback?: string,
  ): Promise<void> {
    const db = getDb();
    db.run(
      "INSERT INTO trajectory_preferences (trajectory_id, rating, feedback) VALUES (?, ?, ?)",
      [trajectoryId, rating, feedback ?? null],
    );
  }

  async getPreferences(
    trajectoryId: string,
  ): Promise<TrajectoryPreference[]> {
    const db = getDb();
    const rows = db
      .query(
        "SELECT trajectory_id, rating, feedback FROM trajectory_preferences WHERE trajectory_id = ? ORDER BY created_at DESC",
      )
      .all(trajectoryId) as Array<{
      trajectory_id: string;
      rating: number;
      feedback: string | null;
    }>;
    return rows.map((r) => ({
      trajectoryId: r.trajectory_id,
      rating: r.rating,
      feedback: r.feedback ?? undefined,
    }));
  }

  async getStats(): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    const db = getDb();
    const total = (
      db.query("SELECT COUNT(*) as cnt FROM trajectories").get() as {
        cnt: number;
      }
    ).cnt;
    const successful = (
      db
        .query("SELECT COUNT(*) as cnt FROM trajectories WHERE success = 1")
        .get() as { cnt: number }
    ).cnt;
    return { total, successful, failed: total - successful };
  }

  private mapRow(row: DbRow): Trajectory {
    return {
      id: row.id,
      task: row.task,
      steps: JSON.parse(row.steps_json),
      result: row.result ?? undefined,
      success: row.success === 1,
      skillName: row.skill_name ?? undefined,
      errorType: row.error_type ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      screenshotDir: row.screenshot_dir ?? undefined,
      metadata: JSON.parse(row.metadata_json || "{}"),
      createdAt: row.created_at,
    };
  }
}

type DbRow = {
  id: string;
  task: string;
  steps_json: string;
  result: string | null;
  success: number;
  skill_name: string | null;
  error_type: string | null;
  duration_ms: number | null;
  screenshot_dir: string | null;
  metadata_json: string;
  created_at: string;
};
