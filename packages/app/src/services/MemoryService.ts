import { z } from 'zod';
import { apiGet, apiPost } from './apiClient';
import {
  NetworkError,
  ValidationError,
  isAppError,
} from '@/errors';

export const MemoryEntrySchema = z.object({
  content: z.string(),
  created_at: z.string().nullable(),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export const MemoryDataSchema = z.object({
  entries: z.object({
    memory: z.array(MemoryEntrySchema),
    user: z.array(MemoryEntrySchema),
  }),
  memory: z.string(),
  user: z.string(),
  memory_entries: z.number(),
  user_entries: z.number(),
});

export type MemoryData = z.infer<typeof MemoryDataSchema>;

export const MemorySearchResultSchema = z.object({
  results: z.array(z.any()),
});

export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;

export interface MemoryService {
  get(): Promise<MemoryData>;
  add(target: 'memory' | 'user', content: string): Promise<{ success: boolean; message: string }>;
  replace(target: 'memory' | 'user', oldEntry: string, newEntry: string): Promise<{ success: boolean; message: string }>;
  remove(target: 'memory' | 'user', entry: string): Promise<{ success: boolean; message: string }>;
  search(query: string, limit?: number): Promise<MemorySearchResult>;
  changelog(target?: string, limit?: number): Promise<{ changes: any[] }>;
  switchSystem(system: 'file' | 'hy'): Promise<{ success: boolean; message: string; current_system: string }>;
  getSystem(): Promise<{ success: boolean; system: string }>;
  getStats(): Promise<{ success: boolean; system: string; stats: any }>;
}

class HttpMemoryService implements MemoryService {
  async get(): Promise<MemoryData> {
    try {
      const response = await apiGet<MemoryData>('/api/memory');
      const validated = MemoryDataSchema.safeParse(response);
      if (!validated.success) {
        throw new NetworkError('Invalid memory data response');
      }
      return validated.data;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to get memory');
    }
  }

  async add(target: 'memory' | 'user', content: string): Promise<{ success: boolean; message: string }> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Memory content cannot be empty');
    }

    try {
      return await apiPost<{ success: boolean; message: string }>('/api/memory/add', {
        target,
        content,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to add memory');
    }
  }

  async replace(target: 'memory' | 'user', oldEntry: string, newEntry: string): Promise<{ success: boolean; message: string }> {
    if (!oldEntry || oldEntry.trim().length === 0) {
      throw new ValidationError('Old entry cannot be empty');
    }
    if (!newEntry || newEntry.trim().length === 0) {
      throw new ValidationError('New entry cannot be empty');
    }

    try {
      return await apiPost<{ success: boolean; message: string }>('/api/memory/replace', {
        target,
        old_entry: oldEntry,
        new_entry: newEntry,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to replace memory');
    }
  }

  async remove(target: 'memory' | 'user', entry: string): Promise<{ success: boolean; message: string }> {
    if (!entry || entry.trim().length === 0) {
      throw new ValidationError('Entry cannot be empty');
    }

    try {
      return await apiPost<{ success: boolean; message: string }>('/api/memory/remove', {
        target,
        entry,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to remove memory');
    }
  }

  async search(query: string, limit = 5): Promise<MemorySearchResult> {
    if (!query || query.trim().length === 0) {
      throw new ValidationError('Search query cannot be empty');
    }

    try {
      return await apiGet<MemorySearchResult>('/api/memory/search', {
        query,
        limit: String(limit),
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to search memory');
    }
  }

  async changelog(target?: string, limit = 20): Promise<{ changes: any[] }> {
    try {
      const params: Record<string, string> = { limit: String(limit) };
      if (target) params.target = target;
      return await apiGet<{ changes: any[] }>('/api/memory/changelog', params);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to get memory changelog');
    }
  }

  async switchSystem(system: 'file' | 'hy'): Promise<{ success: boolean; message: string; current_system: string }> {
    try {
      return await apiPost<{ success: boolean; message: string; current_system: string }>('/api/memory/switch-system', { system });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to switch memory system');
    }
  }

  async getSystem(): Promise<{ success: boolean; system: string }> {
    try {
      return await apiGet<{ success: boolean; system: string }>('/api/memory/system');
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to get memory system');
    }
  }

  async getStats(): Promise<{ success: boolean; system: string; stats: any }> {
    try {
      return await apiGet<{ success: boolean; system: string; stats: any }>('/api/memory/stats');
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to get memory stats');
    }
  }
}

export function createMemoryService(): MemoryService {
  return new HttpMemoryService();
}
