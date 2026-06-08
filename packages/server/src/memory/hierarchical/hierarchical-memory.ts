/**
 * Hierarchical Memory Tree (HMT)
 *
 * Multi-level memory system for agent
 * Organizes memories by scope and enables semantic retrieval
 *
 * @module memory/hierarchical
 */

import { createLogger } from '../../core/logging';
import { randomUUID } from 'node:crypto';

const logger = createLogger('hierarchical-memory');

// ============================================================================
// Type Definitions
// ============================================================================

export type MemoryLevel = 'step' | 'task' | 'session' | 'global';

export interface MemoryNode {
  id: string;
  level: MemoryLevel;
  content: string;
  metadata?: {
    task?: string;
    category?: string;
    success?: boolean;
    relatedNodes?: string[];
    timestamp?: number;
    importance?: number; // 0-1
  };
  embeddings?: number[];  // For semantic search (optional)
  children: MemoryNode[];
  parentId?: string;
}

export interface MemorySearchResult {
  node: MemoryNode;
  relevance: number;
  distance?: number;
}

export interface MemoryStats {
  totalNodes: number;
  nodesByLevel: Record<MemoryLevel, number>;
  totalMemories: number;
  oldestMemory?: number;
  newestMemory?: number;
}

// ============================================================================
// Hierarchical Memory Tree
// ============================================================================

export class HierarchicalMemoryTree {
  private root: MemoryNode = {
    id: 'root',
    level: 'global',
    content: 'Root memory node',
    children: []
  };

  private nodeIndex: Map<string, MemoryNode> = new Map();
  private embeddingModel: any = null; // Optional: for semantic search

  constructor() {
    // Index root node
    this.nodeIndex.set('root', this.root);
    logger.info('[HMT] Hierarchical Memory Tree initialized');
  }

  /**
   * Add memory at specific level
   */
  async addMemory(
    content: string,
    level: MemoryLevel,
    metadata?: {
      task?: string;
      category?: string;
      success?: boolean;
      importance?: number;
    }
  ): Promise<string> {
    const node: MemoryNode = {
      id: randomUUID(),
      level,
      content,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        relatedNodes: []
      },
      children: []
    };

    // Generate embeddings if available
    if (this.embeddingModel) {
      try {
        node.embeddings = await this.embeddingModel.embed(content);
      } catch (error) {
        logger.warn({ err: error as Error }, '[HMT] Failed to generate embeddings');
      }
    }

    // Insert at appropriate level
    this.insertAtLevel(node, level);

    // Index node
    this.nodeIndex.set(node.id, node);

    logger.debug({ id: node.id, level }, '[HMT] Memory added');
    return node.id;
  }

  /**
   * Retrieve memories relevant to query
   */
  async retrieveMemories(
    query: string,
    options: {
      maxResults?: number;
      minRelevance?: number;
      level?: MemoryLevel;
    } = {}
  ): Promise<MemorySearchResult[]> {
    const {
      maxResults = 5,
      minRelevance = 0.6,
      level
    } = options;

    if (!this.embeddingModel) {
      // Fallback to keyword search
      return this.keywordSearch(query, maxResults, level);
    }

    // Generate query embedding
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingModel.embed(query);
    } catch (error) {
      logger.warn({ err: error as Error }, '[HMT] Failed to embed query, using keyword search');
      return this.keywordSearch(query, maxResults, level);
    }

    const results: MemorySearchResult[] = [];

    // Search all indexed nodes
    for (const [id, node] of this.nodeIndex) {
      if (id === 'root') continue;

      // Filter by level if specified
      if (level && node.level !== level) continue;

      if (node.embeddings) {
        const similarity = this.cosineSimilarity(queryEmbedding, node.embeddings);
        if (similarity >= minRelevance) {
          results.push({
            node,
            relevance: similarity
          });
        }
      }
    }

    // Sort by relevance and return top results
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
  }

  /**
   * Get memory context for LLM
   */
  async getMemoryContext(
    task: string,
    options: {
      maxTokens?: number;
      maxMemories?: number;
    } = {}
  ): Promise<string> {
    const {
      maxTokens = 2000,
      maxMemories = 10
    } = options;

    const memories = await this.retrieveMemories(task, { maxResults: maxMemories });

    if (memories.length === 0) {
      return 'No relevant memories found.';
    }

    // Build context string
    const lines: string[] = [];

    for (const result of memories) {
      const mem = result.node;
      const age = this.getMemoryAge(mem);
      const ageStr = age < 60 ? `${age}s ago` : age < 3600 ? `${Math.floor(age/60)}m ago` : `${Math.floor(age/86400)}d ago`;

      lines.push(`- [${mem.level}, ${ageStr}, relevance: ${result.relevance.toFixed(2)}] ${mem.content}`);
    }

    return lines.join('\n');
  }

  /**
   * Get specific memory by ID
   */
  getMemory(id: string): MemoryNode | null {
    return this.nodeIndex.get(id) || null;
  }

  /**
   * Update memory content
   */
  updateMemory(id: string, content: string): boolean {
    const node = this.nodeIndex.get(id);
    if (!node) return false;

    node.content = content;
    if (node.metadata) {
      node.metadata.timestamp = Date.now();
    }

    logger.debug({ id }, '[HMT] Memory updated');
    return true;
  }

  /**
   * Delete memory
   */
  deleteMemory(id: string): boolean {
    const node = this.nodeIndex.get(id);
    if (!node) return false;

    // Remove from parent
    if (node.parentId) {
      const parent = this.nodeIndex.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(child => child.id !== id);
      }
    }

    // Delete children recursively
    for (const child of node.children) {
      this.deleteMemory(child.id);
    }

    // Remove from index
    this.nodeIndex.delete(id);

    logger.debug({ id }, '[HMT] Memory deleted');
    return true;
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const stats: MemoryStats = {
      totalNodes: this.nodeIndex.size - 1, // Exclude root
      nodesByLevel: {
        step: 0,
        task: 0,
        session: 0,
        global: 0
      },
      totalMemories: 0
    };

    let oldest: number | undefined;
    let newest: number | undefined;

    for (const [id, node] of this.nodeIndex) {
      if (id === 'root') continue;

      stats.nodesByLevel[node.level]++;
      stats.totalMemories++;

      if (node.metadata?.timestamp) {
        if (!oldest || node.metadata.timestamp < oldest) {
          oldest = node.metadata.timestamp;
        }
        if (!newest || node.metadata.timestamp > newest) {
          newest = node.metadata.timestamp;
        }
      }
    }

    stats.oldestMemory = oldest;
    stats.newestMemory = newest;

    return stats;
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.root = {
      id: 'root',
      level: 'global',
      content: 'Root memory node',
      children: []
    };
    this.nodeIndex.clear();
    this.nodeIndex.set('root', this.root);
    logger.info('[HMT] All memories cleared');
  }

  /**
   * Set embedding model for semantic search
   */
  setEmbeddingModel(model: any): void {
    this.embeddingModel = model;
    logger.info('[HMT] Embedding model set');
  }

  /**
   * Export memories as JSON
   */
  export(): string {
    return JSON.stringify({
      root: this.root,
      nodes: Array.from(this.nodeIndex.entries())
    }, null, 2);
  }

  /**
   * Import memories from JSON
   */
  import(data: string): boolean {
    try {
      const parsed = JSON.parse(data);

      if (parsed.root) {
        this.root = parsed.root;
      }

      if (parsed.nodes) {
        this.nodeIndex = new Map(parsed.nodes);
      }

      logger.info('[HMT] Memories imported');
      return true;
    } catch (error) {
      logger.error({ err: error as Error }, '[HMT] Failed to import memories');
      return false;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private insertAtLevel(node: MemoryNode, level: MemoryLevel): void {
    // Find or create level node
    let levelNode = this.root.children.find(child => child.level === level);

    if (!levelNode) {
      levelNode = {
        id: randomUUID(),
        level,
        content: `${level} memories`,
        children: []
      };
      this.root.children.push(levelNode!);
      this.nodeIndex.set(levelNode!.id, levelNode!);
    }

    // Add to level node
    levelNode!.children.push(node);
    node.parentId = levelNode!.id;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  private keywordSearch(
    query: string,
    maxResults: number,
    level?: MemoryLevel
  ): MemorySearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const results: MemorySearchResult[] = [];

    for (const [id, node] of this.nodeIndex) {
      if (id === 'root') continue;
      if (level && node.level !== level) continue;

      const contentLower = node.content.toLowerCase();
      let score = 0;

      // Exact phrase match
      if (contentLower.includes(queryLower)) {
        score += 10;
      }

      // Word matches
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += 2;
        }
      }

      if (score > 0) {
        results.push({
          node,
          relevance: Math.min(1, score / 20) // Normalize to 0-1
        });
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
  }

  private getMemoryAge(node: MemoryNode): number {
    if (!node.metadata?.timestamp) return 0;
    return Math.floor((Date.now() - node.metadata.timestamp) / 1000);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const hmt = new HierarchicalMemoryTree();
