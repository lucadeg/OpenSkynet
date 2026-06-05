import { LocalSkillsService } from '@/services/LocalSkillsService';

function createMocks() {
  return {
    skillEngine: {
      list: jest.fn(),
      get: jest.fn(),
      run: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    hubClient: {
      browse: jest.fn(),
      install: jest.fn(),
      remove: jest.fn(),
    },
    skillSearch: {
      search: jest.fn(),
    },
  };
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new LocalSkillsService({
    skillEngine: mocks.skillEngine,
    hubClient: mocks.hubClient,
    skillSearch: mocks.skillSearch,
  });
}

describe('LocalSkillsService', () => {
  let mocks: ReturnType<typeof createMocks>;
  let service: LocalSkillsService;

  beforeEach(() => {
    mocks = createMocks();
    service = createService(mocks);
  });

  describe('list()', () => {
    it('delegates to skillEngine.list()', async () => {
      const skills = [{ name: 'skill-a' }, { name: 'skill-b' }];
      mocks.skillEngine.list.mockReturnValue(skills);

      const result = await service.list();

      expect(mocks.skillEngine.list).toHaveBeenCalledTimes(1);
      expect(result).toEqual(skills);
    });

    it('returns an empty array when no skills exist', async () => {
      mocks.skillEngine.list.mockReturnValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
    });
  });

  describe('browse()', () => {
    it('delegates to hubClient.browse() without a category', async () => {
      const hubSkills = [{ name: 'hub-skill-1' }];
      mocks.hubClient.browse.mockResolvedValue(hubSkills);

      const result = await service.browse();

      expect(mocks.hubClient.browse).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(hubSkills);
    });

    it('delegates to hubClient.browse() with a category', async () => {
      const hubSkills = [{ name: 'hub-skill-2' }];
      mocks.hubClient.browse.mockResolvedValue(hubSkills);

      const result = await service.browse('productivity');

      expect(mocks.hubClient.browse).toHaveBeenCalledWith('productivity');
      expect(result).toEqual(hubSkills);
    });
  });

  describe('search()', () => {
    it('delegates to skillSearch.search()', async () => {
      const results = [{ name: 'found-skill' }];
      mocks.skillSearch.search.mockResolvedValue(results);

      const result = await service.search('test query');

      expect(mocks.skillSearch.search).toHaveBeenCalledWith('test query');
      expect(result).toEqual(results);
    });

    it('returns empty results when nothing matches', async () => {
      mocks.skillSearch.search.mockResolvedValue([]);

      const result = await service.search('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('get()', () => {
    it('delegates to skillEngine.get()', async () => {
      const skill = { name: 'my-skill' };
      mocks.skillEngine.get.mockReturnValue(skill);

      const result = await service.get('my-skill');

      expect(mocks.skillEngine.get).toHaveBeenCalledWith('my-skill');
      expect(result).toEqual(skill);
    });
  });

  describe('install()', () => {
    it('delegates to hubClient.install() without force', async () => {
      const response = { installed: 'cool-skill', message: 'Installed!' };
      mocks.hubClient.install.mockResolvedValue(response);

      const result = await service.install('cool-skill');

      expect(mocks.hubClient.install).toHaveBeenCalledWith('cool-skill', false);
      expect(result).toEqual(response);
    });

    it('delegates to hubClient.install() with force=true', async () => {
      const response = { installed: 'cool-skill', message: 'Reinstalled!' };
      mocks.hubClient.install.mockResolvedValue(response);

      const result = await service.install('cool-skill', true);

      expect(mocks.hubClient.install).toHaveBeenCalledWith('cool-skill', true);
      expect(result).toEqual(response);
    });
  });

  describe('remove()', () => {
    it('delegates to hubClient.remove()', async () => {
      const response = { removed: 'old-skill' };
      mocks.hubClient.remove.mockResolvedValue(response);

      const result = await service.remove('old-skill');

      expect(mocks.hubClient.remove).toHaveBeenCalledWith('old-skill');
      expect(result).toEqual(response);
    });
  });

  describe('run()', () => {
    it('returns a string result directly', async () => {
      mocks.skillEngine.run.mockResolvedValue('hello world');

      const result = await service.run('greeter');

      expect(mocks.skillEngine.run).toHaveBeenCalledWith('greeter');
      expect(result).toEqual({ result: 'hello world' });
    });

    it('serializes an object result to JSON', async () => {
      const obj = { key: 'value', count: 42 };
      mocks.skillEngine.run.mockResolvedValue(obj);

      const result = await service.run('json-skill');

      expect(result).toEqual({ result: JSON.stringify(obj) });
    });

    it('serializes an array result to JSON', async () => {
      const arr = [1, 2, 3];
      mocks.skillEngine.run.mockResolvedValue(arr);

      const result = await service.run('array-skill');

      expect(result).toEqual({ result: JSON.stringify(arr) });
    });

    it('serializes a numeric result to JSON', async () => {
      mocks.skillEngine.run.mockResolvedValue(99);

      const result = await service.run('num-skill');

      expect(result).toEqual({ result: '99' });
    });
  });

  describe('create()', () => {
    it('delegates to skillEngine.create()', async () => {
      const input = { name: 'new-skill', content: 'do stuff' };
      const created = { name: 'new-skill' };
      mocks.skillEngine.create.mockResolvedValue(created);

      const result = await service.create(input);

      expect(mocks.skillEngine.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(created);
    });
  });

  describe('delete()', () => {
    it('delegates to skillEngine.delete() and returns the name', async () => {
      mocks.skillEngine.delete.mockResolvedValue(undefined);

      const result = await service.delete('unwanted-skill');

      expect(mocks.skillEngine.delete).toHaveBeenCalledWith('unwanted-skill');
      expect(result).toEqual({ deleted: 'unwanted-skill' });
    });
  });
});
