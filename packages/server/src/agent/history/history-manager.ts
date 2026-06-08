/**
 * Agent History Manager
 *
 * Saves and loads agent execution history for debugging and rerunning
 * Provides ability to export and rerun agent sessions
 *
 * @module agent/history/history-manager
 */

import { randomUUID } from 'node:crypto';
import { writeFile, readFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getConfig } from '../../core/config';
import { createLogger } from '../../core/logging';
import type { StepEvent } from '../../core/types';

const logger = createLogger('agent-history');

export interface AgentHistoryEntry {
  id: string;
  task: string;
  timestamp: string;
  steps: StepEvent[];
  result: string;
  success: boolean;
  iterations: number;
  strategyUsed: string;
  elapsedSecs: number;
  conversation?: Array<{ role: string; content: string | any[] }>;
  actionsTaken: string[];
  metadata?: {
    category?: string;
    mode?: string;
    startTime?: string;
    endTime?: string;
    [key: string]: unknown;
  };
}

export class AgentHistoryManager {
  private historyDir: string;

  constructor() {
    const config = getConfig();
    this.historyDir = join(config.dataDir, 'agent_history');

    // Ensure directory exists
    this.ensureDir();
  }

  /**
   * Ensure history directory exists
   */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.historyDir)) {
      await mkdir(this.historyDir, { recursive: true });
    }
  }

  /**
   * Save agent execution to history
   */
  async saveToHistory(entry: Omit<AgentHistoryEntry, 'id' | 'timestamp'>): Promise<string> {
    await this.ensureDir();

    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const historyEntry: AgentHistoryEntry = {
      id,
      timestamp,
      ...entry
    };

    const filename = join(this.historyDir, `${id}.json`);
    await writeFile(filename, JSON.stringify(historyEntry, null, 2), 'utf-8');

    logger.info({ id, task: entry.task.slice(0, 50) }, "history_saved");

    return id;
  }

  /**
   * Load history entry by ID
   */
  async loadHistory(id: string): Promise<AgentHistoryEntry | null> {
    await this.ensureDir();

    const filename = join(this.historyDir, `${id}.json`);

    if (!existsSync(filename)) {
      logger.warn({ id }, "history_not_found");
      return null;
    }

    try {
      const content = await readFile(filename, 'utf-8');
      return JSON.parse(content) as AgentHistoryEntry;
    } catch (error) {
      logger.error({ err: (error as Error).message, id }, "history_load_failed");
      return null;
    }
  }

  /**
   * List all history entries
   */
  async listHistory(limit = 50): Promise<AgentHistoryEntry[]> {
    await this.ensureDir();

    try {
      const files = await readdir(this.historyDir);
      const entries: AgentHistoryEntry[] = [];

      for (const file of files.slice(-limit)) {
        if (file.endsWith('.json')) {
          try {
            const content = await readFile(join(this.historyDir, file), 'utf-8');
            entries.push(JSON.parse(content) as AgentHistoryEntry);
          } catch (error) {
            logger.warn({ err: (error as Error).message, file }, "history_entry_skip");
          }
        }
      }

      // Sort by timestamp descending (newest first)
      return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      logger.error({ err: (error as Error).message }, "history_list_failed");
      return [];
    }
  }

  /**
   * Search history by task content
   */
  async searchHistory(query: string, limit = 20): Promise<AgentHistoryEntry[]> {
    const allHistory = await this.listHistory();
    const lowerQuery = query.toLowerCase();

    return allHistory
      .filter(entry =>
        entry.task.toLowerCase().includes(lowerQuery) ||
        entry.result.toLowerCase().includes(lowerQuery) ||
        entry.actionsTaken.some(action => action.toLowerCase().includes(lowerQuery))
      )
      .slice(0, limit);
  }

  /**
   * Create rerun configuration from history
   */
  async createRerunConfig(id: string): Promise<{
    task: string;
    conversation: Array<{ role: string; content: string | any[] }>;
    metadata: Record<string, unknown>;
  } | null> {
    const entry = await this.loadHistory(id);

    if (!entry) {
      return null;
    }

    return {
      task: entry.task,
      conversation: entry.conversation || [],
      metadata: {
        originalId: entry.id,
        originalTimestamp: entry.timestamp,
        originalResult: entry.result,
        originalSuccess: entry.success,
        originalIterations: entry.iterations,
        originalStrategy: entry.strategyUsed,
        originalElapsedSecs: entry.elapsedSecs,
        originalActions: entry.actionsTaken,
      }
    };
  }

  /**
   * Delete history entry
   */
  async deleteHistory(id: string): Promise<boolean> {
    const filename = join(this.historyDir, `${id}.json`);

    if (!existsSync(filename)) {
      return false;
    }

    try {
      await unlink(filename);
      logger.info({ id }, "history_deleted");
      return true;
    } catch (error) {
      logger.error({ err: (error as Error).message, id }, "history_delete_failed");
      return false;
    }
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<number> {
    await this.ensureDir();

    try {
      const files = await readdir(this.historyDir);
      let deleted = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            await unlink(join(this.historyDir, file));
            deleted++;
          } catch (error) {
            logger.warn({ err: (error as Error).message, file }, "history_clear_skip");
          }
        }
      }

      logger.info({ deleted }, "history_cleared");
      return deleted;
    } catch (error) {
      logger.error({ err: (error as Error).message }, "history_clear_failed");
      return 0;
    }
  }

  /**
   * Get history statistics
   */
  async getHistoryStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry?: string;
    newestEntry?: string;
  }> {
    await this.ensureDir();

    try {
      const files = await readdir(this.historyDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      let totalSize = 0;
      let oldestTimestamp: string | null = null;
      let newestTimestamp: string | null = null;

      for (const file of jsonFiles) {
        const filePath = join(this.historyDir, file);
        const stats = await (await import('node:fs/promises')).stat(filePath);
        totalSize += stats.size;

        // Extract timestamp from filename
        const content = await readFile(filePath, 'utf-8');
        const entry = JSON.parse(content) as AgentHistoryEntry;

        if (!oldestTimestamp || entry.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.timestamp;
        }
        if (!newestTimestamp || entry.timestamp > newestTimestamp) {
          newestTimestamp = entry.timestamp;
        }
      }

      return {
        totalEntries: jsonFiles.length,
        totalSize,
        oldestEntry: oldestTimestamp || undefined,
        newestEntry: newestTimestamp || undefined,
      };
    } catch (error) {
      logger.error({ err: (error as Error).message }, "history_stats_failed");
      return {
        totalEntries: 0,
        totalSize: 0,
      };
    }
  }

  /**
   * Prune old history entries
   */
  async pruneOldEntries(maxEntries?: number): Promise<number> {
    const config = getConfig();
    const maxHistory = maxEntries ?? config.maxHistoryEntries;

    const allHistory = await this.listHistory(maxHistory + 100);

    if (allHistory.length <= maxHistory) {
      return 0; // No pruning needed
    }

    const toDelete = allHistory.slice(maxHistory);
    let deleted = 0;

    for (const entry of toDelete) {
      const success = await this.deleteHistory(entry.id);
      if (success) {
        deleted++;
      }
    }

    logger.info({ deleted, total: toDelete.length }, "history_pruned");
    return deleted;
  }

  /**
   * Get history directory path
   */
  getHistoryDir(): string {
    return this.historyDir;
  }
}

/**
 * Create an agent history manager instance
 */
export function createAgentHistoryManager(): AgentHistoryManager {
  return new AgentHistoryManager();
}
