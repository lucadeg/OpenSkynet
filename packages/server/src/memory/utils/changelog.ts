export interface ChangeEntry {
  action: string;
  target: string;
  content?: string;
  reason?: string;
  timestamp: string;
}

export class Changelog {
  private changes: ChangeEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  getRecentChanges(target?: string, limit = 50): ChangeEntry[] {
    let filtered = this.changes;
    if (target) {
      filtered = filtered.filter((c) => c.target === target);
    }
    return filtered.slice(0, limit);
  }

  addChange(
    action: string,
    target: string,
    content?: string,
    reason?: string,
  ): void {
    this.changes.unshift({
      action,
      target,
      content,
      reason,
      timestamp: new Date().toISOString(),
    });
    if (this.changes.length > this.maxEntries) {
      this.changes = this.changes.slice(0, this.maxEntries);
    }
  }
}
