import type { StepEvent } from "../../core/types.js";

export class PersistenceManager {
  private sessions = new Map<string, Record<string, unknown>>();

  async saveSession(task: string, steps: StepEvent[], result: string): Promise<string> {
    const id = crypto.randomUUID();
    this.sessions.set(id, {
      id,
      task,
      steps,
      result,
      created_at: new Date().toISOString(),
    });
    return id;
  }

  async loadSession(id: string): Promise<Record<string, unknown> | null> {
    return this.sessions.get(id) ?? null;
  }
}
