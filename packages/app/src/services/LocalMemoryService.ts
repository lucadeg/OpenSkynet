import type { MemoryService, MemoryData, MemorySearchResult } from './MemoryService';

export class LocalMemoryService implements MemoryService {
  private memory: any;

  constructor(memory: any) {
    this.memory = memory;
  }

  async get(): Promise<MemoryData> {
    const [memoryContent, userContent, memoryEntries, userEntries] = await Promise.all([
      this.memory.read('memory'),
      this.memory.read('user'),
      this.memory.entries('memory'),
      this.memory.entries('user'),
    ]);

    return {
      entries: {
        memory: memoryEntries || [],
        user: userEntries || [],
      },
      memory: memoryContent || '',
      user: userContent || '',
      memory_entries: memoryEntries?.length || 0,
      user_entries: userEntries?.length || 0,
    };
  }

  async add(target: 'memory' | 'user', content: string): Promise<{ success: boolean; message: string }> {
    await this.memory.add(target, content);
    return { success: true, message: `Added to ${target}` };
  }

  async replace(target: 'memory' | 'user', oldEntry: string, newEntry: string): Promise<{ success: boolean; message: string }> {
    await this.memory.replace(target, oldEntry, newEntry);
    return { success: true, message: `Replaced entry in ${target}` };
  }

  async remove(target: 'memory' | 'user', entry: string): Promise<{ success: boolean; message: string }> {
    await this.memory.remove(target, entry);
    return { success: true, message: `Removed entry from ${target}` };
  }

  async search(query: string, limit = 5): Promise<MemorySearchResult> {
    const results = await this.memory.search(query, limit);
    return { results };
  }

  async changelog(_target?: string, _limit = 20): Promise<{ changes: any[] }> {
    return { changes: [] };
  }

  async switchSystem(system: 'file' | 'hy'): Promise<{ success: boolean; message: string; current_system: string }> {
    return { success: true, message: 'Switched', current_system: system };
  }

  async getSystem(): Promise<{ success: boolean; system: string }> {
    return { success: true, system: 'file' };
  }

  async getStats(): Promise<{ success: boolean; system: string; stats: any }> {
    return { success: true, system: 'file', stats: {} };
  }
}
