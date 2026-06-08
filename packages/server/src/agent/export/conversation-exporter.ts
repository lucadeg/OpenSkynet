/**
 * Conversation Exporter
 *
 * Exports agent conversations to multiple formats for analysis and debugging
 * Supports JSON, Markdown, and plain text formats
 *
 * @module agent/export/conversation-exporter
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { getConfig } from '../../core/config';
import { createLogger } from '../../core/logging';

const logger = createLogger('conversation-exporter');

export interface ConversationExportFormat {
  json: boolean;
  markdown: boolean;
  txt: boolean;
}

export interface ConversationData {
  sessionId: string;
  task: string;
  conversation: Array<{ role: string; content: string | any[] }>;
  result: string;
  success: boolean;
  iterations: number;
  strategyUsed: string;
  elapsedSecs: number;
  actionsTaken: string[];
  metadata?: Record<string, unknown>;
}

export class ConversationExporter {
  private exportDir: string;

  constructor() {
    const config = getConfig();
    this.exportDir = join(config.dataDir, 'conversations');

    // Ensure directory exists
    this.ensureDir();
  }

  /**
   * Ensure export directory exists
   */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.exportDir)) {
      await mkdir(this.exportDir, { recursive: true });
    }
  }

  /**
   * Export conversation to multiple formats
   *
   * @param data - Conversation data to export
   * @param formats - Which formats to export
   * @returns Array of exported file paths
   */
  async exportConversation(
    data: ConversationData,
    formats: ConversationExportFormat = { json: true, markdown: true, txt: false }
  ): Promise<string[]> {
    await this.ensureDir();

    const exportedFiles: string[] = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${data.sessionId}_${timestamp}`;

    // Export as JSON
    if (formats.json) {
      const jsonPath = join(this.exportDir, `${baseName}.json`);
      await writeFile(
        jsonPath,
        JSON.stringify({
          sessionId: data.sessionId,
          task: data.task,
          conversation: data.conversation,
          result: data.result,
          success: data.success,
          iterations: data.iterations,
          strategyUsed: data.strategyUsed,
          elapsedSecs: data.elapsedSecs,
          actionsTaken: data.actionsTaken,
          metadata: data.metadata,
          exportedAt: new Date().toISOString(),
        }, null, 2),
        'utf-8'
      );
      exportedFiles.push(jsonPath);
      logger.info({ file: jsonPath }, "conversation_exported_json");
    }

    // Export as Markdown
    if (formats.markdown) {
      const markdownPath = join(this.exportDir, `${baseName}.md`);
      const markdown = this.formatAsMarkdown(data);
      await writeFile(markdownPath, markdown, 'utf-8');
      exportedFiles.push(markdownPath);
      logger.info({ file: markdownPath }, "conversation_exported_markdown");
    }

    // Export as plain text
    if (formats.txt) {
      const txtPath = join(this.exportDir, `${baseName}.txt`);
      const txt = this.formatAsText(data);
      await writeFile(txtPath, txt, 'utf-8');
      exportedFiles.push(txtPath);
      logger.info({ file: txtPath }, "conversation_exported_txt");
    }

    return exportedFiles;
  }

  /**
   * Format conversation as Markdown
   */
  private formatAsMarkdown(data: ConversationData): string {
    const lines: string[] = [];

    lines.push(`# Agent Conversation`);
    lines.push();
    lines.push(`**Session ID:** ${data.sessionId}`);
    lines.push(`**Task:** ${data.task}`);
    lines.push(`**Success:** ${data.success ? '✅' : '❌'}`);
    lines.push(`**Iterations:** ${data.iterations}`);
    lines.push(`**Strategy:** ${data.strategyUsed}`);
    lines.push(`**Elapsed Time:** ${data.elapsedSecs}s`);
    lines.push(`**Actions Taken:** ${data.actionsTaken.join(', ')}`);
    lines.push(`**Result:** ${data.result}`);
    lines.push();

    if (data.metadata) {
      lines.push(`## Metadata`);
      lines.push();
      for (const [key, value] of Object.entries(data.metadata)) {
        lines.push(`- **${key}:** ${JSON.stringify(value)}`);
      }
      lines.push();
    }

    lines.push(`## Conversation`);
    lines.push();

    for (const [index, msg] of data.conversation.entries()) {
      lines.push(`### ${msg.role.toUpperCase()} #${index + 1}`);
      lines.push();

      if (typeof msg.content === 'string') {
        lines.push(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            lines.push(part.text);
          } else if (part.type === 'image_url') {
            const urlPreview = part.image_url.url.slice(0, 60) + '...';
            lines.push(`[Image: ${urlPreview}]`);
          }
        }
      }

      lines.push();
    }

    return lines.join('\n');
  }

  /**
   * Format conversation as plain text
   */
  private formatAsText(data: ConversationData): string {
    const lines: string[] = [];

    lines.push('Agent Conversation');
    lines.push(`Session ID: ${data.sessionId}`);
    lines.push(`Task: ${data.task}`);
    lines.push(`Success: ${data.success}`);
    lines.push(`Iterations: ${data.iterations}`);
    lines.push(`Strategy: ${data.strategyUsed}`);
    lines.push(`Elapsed Time: ${data.elapsedSecs}s`);
    lines.push(`Actions Taken: ${data.actionsTaken.join(', ')}`);
    lines.push(`Result: ${data.result}`);
    lines.push();
    lines.push('='.repeat(80));
    lines.push();

    for (const [index, msg] of data.conversation.entries()) {
      lines.push(`${msg.role.toUpperCase()} #${index + 1}`);
      lines.push('-'.repeat(80));

      if (typeof msg.content === 'string') {
        lines.push(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            lines.push(part.text);
          } else if (part.type === 'image_url') {
            const urlPreview = part.image_url.url.slice(0, 60) + '...';
            lines.push(`[Image: ${urlPreview}]`);
          }
        }
      }

      lines.push();
    }

    return lines.join('\n');
  }

  /**
   * Get list of exported conversations
   */
  async listExportedConversations(limit = 50): Promise<Array<{
    filename: string;
    sessionId: string;
    timestamp: string;
    format: string;
  }>> {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(this.exportDir);

    const conversations = files
      .filter(filename => filename.endsWith('.json') || filename.endsWith('.md') || filename.endsWith('.txt'))
      .map(filename => {
        const parts = filename.split('_');
        return {
          filename,
          sessionId: parts[0] || 'unknown',
          timestamp: parts[1] || 'unknown',
          format: filename.split('.').pop() || 'unknown'
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);

    return conversations;
  }

  /**
   * Load exported conversation
   */
  async loadConversation(sessionId: string, timestamp?: string): Promise<ConversationData | null> {
    const { readdir, readFile } = await import('node:fs/promises');
    const files = await readdir(this.exportDir);

    // Find matching file
    const matchingFile = files.find(filename => {
      const parts = filename.split('_');
      return parts[0] === sessionId && (!timestamp || parts[1]?.startsWith(timestamp));
    });

    if (!matchingFile) {
      return null;
    }

    try {
      const content = await readFile(join(this.exportDir, matchingFile), 'utf-8');
      return JSON.parse(content) as ConversationData;
    } catch (error) {
      logger.error({ err: (error as Error).message }, "load_conversation_failed");
      return null;
    }
  }

  /**
   * Delete exported conversation
   */
  async deleteConversation(sessionId: string, timestamp?: string): Promise<boolean> {
    const { unlink, readdir } = await import('node:fs/promises');
    const files = await readdir(this.exportDir);

    let deleted = false;

    for (const filename of files) {
      const parts = filename.split('_');
      if (parts[0] === sessionId && (!timestamp || parts[1]?.startsWith(timestamp))) {
        try {
          await unlink(join(this.exportDir, filename));
          deleted = true;
        } catch (error) {
          logger.warn({ err: (error as Error).message }, "delete_conversation_failed");
        }
      }
    }

    return deleted;
  }

  /**
   * Clear all exported conversations
   */
  async clearAllConversations(): Promise<number> {
    const { unlink, readdir } = await import('node:fs/promises');
    const files = await readdir(this.exportDir);

    let deleted = 0;

    for (const file of files) {
      try {
        await unlink(join(this.exportDir, file));
        deleted++;
      } catch (error) {
        logger.warn({ err: (error as Error).message, file }, "clear_conversations_failed");
      }
    }

    return deleted;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return randomUUID();
  }

  /**
   * Get export directory path
   */
  getExportDir(): string {
    return this.exportDir;
  }
}

/**
 * Create a conversation exporter instance
 */
export function createConversationExporter(): ConversationExporter {
  return new ConversationExporter();
}
