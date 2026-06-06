export interface HyMemoryRecord {
  id: string;
  content: string;
  target: string;
  type: string;
  source: string;
  embedding: number[];
  createdAt: string;
  accessedAt: string;
  accessCount: number;
  importance: number;
  connections: string[];
}

export interface HyMemoryStats {
  totalEntries: number;
  byType: Record<string, number>;
  byTarget: Record<string, number>;
  avgImportance: number;
  lastConsolidation: string | null;
}
