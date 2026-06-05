import { LocalMemoryService } from '@/services/LocalMemoryService';

function createMockMemory(overrides: Partial<{
  read: ReturnType<typeof jest.fn>;
  entries: ReturnType<typeof jest.fn>;
  add: ReturnType<typeof jest.fn>;
  replace: ReturnType<typeof jest.fn>;
  remove: ReturnType<typeof jest.fn>;
  search: ReturnType<typeof jest.fn>;
}> = {}) {
  return {
    read: jest.fn().mockResolvedValue('some content'),
    entries: jest.fn().mockResolvedValue(['entry1', 'entry2']),
    add: jest.fn().mockResolvedValue(undefined),
    replace: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([{ text: 'result1' }]),
    ...overrides,
  };
}

describe('LocalMemoryService', () => {
  let service: LocalMemoryService;

  beforeEach(() => {
    service = new LocalMemoryService(createMockMemory());
  });

  describe('get()', () => {
    it('calls memory.read() and memory.entries() for both targets', async () => {
      const memory = createMockMemory();
      service = new LocalMemoryService(memory);

      await service.get();

      expect(memory.read).toHaveBeenCalledWith('memory');
      expect(memory.read).toHaveBeenCalledWith('user');
      expect(memory.entries).toHaveBeenCalledWith('memory');
      expect(memory.entries).toHaveBeenCalledWith('user');
    });

    it('returns the correct MemoryData shape', async () => {
      const memory = createMockMemory({
        read: jest.fn()
          .mockResolvedValueOnce('memory content')
          .mockResolvedValueOnce('user content'),
        entries: jest.fn()
          .mockResolvedValueOnce(['m1', 'm2'])
          .mockResolvedValueOnce(['u1']),
      });
      service = new LocalMemoryService(memory);

      const result = await service.get();

      expect(result).toEqual({
        entries: {
          memory: ['m1', 'm2'],
          user: ['u1'],
        },
        memory: 'memory content',
        user: 'user content',
        memory_entries: 2,
        user_entries: 1,
      });
    });

    it('handles null values with fallbacks', async () => {
      const memory = createMockMemory({
        read: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        entries: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
      });
      service = new LocalMemoryService(memory);

      const result = await service.get();

      expect(result).toEqual({
        entries: {
          memory: [],
          user: [],
        },
        memory: '',
        user: '',
        memory_entries: 0,
        user_entries: 0,
      });
    });
  });

  describe('add()', () => {
    it('calls memory.add() with target and content', async () => {
      const memory = createMockMemory();
      service = new LocalMemoryService(memory);

      await service.add('memory', 'new info');

      expect(memory.add).toHaveBeenCalledWith('memory', 'new info');
    });

    it('returns success with correct message', async () => {
      const result = await service.add('user', 'some content');

      expect(result).toEqual({ success: true, message: 'Added to user' });
    });
  });

  describe('replace()', () => {
    it('calls memory.replace() with target, oldEntry, and newEntry', async () => {
      const memory = createMockMemory();
      service = new LocalMemoryService(memory);

      await service.replace('memory', 'old', 'new');

      expect(memory.replace).toHaveBeenCalledWith('memory', 'old', 'new');
    });

    it('returns success with correct message', async () => {
      const result = await service.replace('user', 'old entry', 'new entry');

      expect(result).toEqual({ success: true, message: 'Replaced entry in user' });
    });
  });

  describe('remove()', () => {
    it('calls memory.remove() with target and entry', async () => {
      const memory = createMockMemory();
      service = new LocalMemoryService(memory);

      await service.remove('memory', 'unwanted entry');

      expect(memory.remove).toHaveBeenCalledWith('memory', 'unwanted entry');
    });

    it('returns success with correct message', async () => {
      const result = await service.remove('user', 'entry to delete');

      expect(result).toEqual({ success: true, message: 'Removed entry from user' });
    });
  });

  describe('search()', () => {
    it('calls memory.search() with query and limit', async () => {
      const memory = createMockMemory();
      service = new LocalMemoryService(memory);

      await service.search('test query', 10);

      expect(memory.search).toHaveBeenCalledWith('test query', 10);
    });

    it('defaults limit to 5', async () => {
      const memory = createMockMemory();
      service = new LocalMemoryService(memory);

      await service.search('test query');

      expect(memory.search).toHaveBeenCalledWith('test query', 5);
    });

    it('wraps results in { results }', async () => {
      const mockResults = [{ text: 'r1' }, { text: 'r2' }];
      const memory = createMockMemory({
        search: jest.fn().mockResolvedValue(mockResults),
      });
      service = new LocalMemoryService(memory);

      const result = await service.search('query');

      expect(result).toEqual({ results: mockResults });
    });
  });

  describe('changelog()', () => {
    it('returns empty changes array', async () => {
      const result = await service.changelog();

      expect(result).toEqual({ changes: [] });
    });

    it('returns empty changes even when target and limit are provided', async () => {
      const result = await service.changelog('memory', 50);

      expect(result).toEqual({ changes: [] });
    });
  });

  describe('switchSystem()', () => {
    it('returns success with "file" system', async () => {
      const result = await service.switchSystem('file');

      expect(result).toEqual({ success: true, message: 'Switched', current_system: 'file' });
    });

    it('returns success with "hy" system', async () => {
      const result = await service.switchSystem('hy');

      expect(result).toEqual({ success: true, message: 'Switched', current_system: 'hy' });
    });
  });

  describe('getSystem()', () => {
    it('returns "file" system', async () => {
      const result = await service.getSystem();

      expect(result).toEqual({ success: true, system: 'file' });
    });
  });

  describe('getStats()', () => {
    it('returns empty stats', async () => {
      const result = await service.getStats();

      expect(result).toEqual({ success: true, system: 'file', stats: {} });
    });
  });
});
