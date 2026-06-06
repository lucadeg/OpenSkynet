import { LocalAgentService } from '@/services/LocalAgentService';
import type { LocalServerDeps } from '@/services/LocalAgentService';

function createMockDeps(overrides: Partial<LocalServerDeps> = {}): LocalServerDeps {
  return {
    agentLoop: {
      run: jest.fn(),
      cancel: jest.fn(),
    },
    skillEngine: {},
    memory: {},
    hubClient: {},
    gitHubInstaller: {},
    skillSearch: {},
    cronManager: {},
    changelog: {},
    checkpointManager: {},
    browserSession: {},
    browserController: {},
    llmProvider: {},
    headless: false,
    sandboxMode: 'off',
    tasksCompleted: 0,
    terminalAllowed: false,
    activeRecording: null,
    ...overrides,
  };
}

describe('LocalAgentService', () => {
  let deps: LocalServerDeps;
  let service: LocalAgentService;

  beforeEach(() => {
    deps = createMockDeps();
    service = new LocalAgentService(deps);
  });

  describe('run()', () => {
    it('delegates to agentLoop.run() with correct args', async () => {
      const mockResult = { success: true, steps: [], result: 'done' };
      (deps.agentLoop.run as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.run('do something', 'worker');

      expect(deps.agentLoop.run).toHaveBeenCalledWith('do something', 'worker');
      expect(result).toBe(mockResult);
    });

    it('defaults mode to "manager"', async () => {
      (deps.agentLoop.run as jest.Mock).mockResolvedValue({});

      await service.run('task');

      expect(deps.agentLoop.run).toHaveBeenCalledWith('task', 'manager');
    });
  });

  describe('stream()', () => {
    it('invokes onProgress for each step and calls onChunk and onDone', async () => {
      const steps = [
        { phase: 'planning', action: 'analyze', url: 'https://example.com/1' },
        { phase: 'executing', action: 'navigate', url: 'https://example.com/2' },
        { phase: 'done', action: 'complete', url: null },
      ];
      const mockResult = { success: true, steps, result: 'final output' };
      (deps.agentLoop.run as jest.Mock).mockResolvedValue(mockResult);

      const onProgress = jest.fn();
      const onChunk = jest.fn();
      const onDone = jest.fn();
      const onError = jest.fn();

      await service.stream('my task', { onProgress, onChunk, onDone, onError });

      expect(deps.agentLoop.run).toHaveBeenCalledWith('my task', 'manager');

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenNthCalledWith(1, {
        phase: 'planning',
        action: 'analyze',
        url: 'https://example.com/1',
        step: 0,
      });
      expect(onProgress).toHaveBeenNthCalledWith(2, {
        phase: 'executing',
        action: 'navigate',
        url: 'https://example.com/2',
        step: 1,
      });
      expect(onProgress).toHaveBeenNthCalledWith(3, {
        phase: 'done',
        action: 'complete',
        url: null,
        step: 2,
      });

      expect(onChunk).toHaveBeenCalledWith('final output', 'done');
      expect(onDone).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('accepts a custom mode', async () => {
      (deps.agentLoop.run as jest.Mock).mockResolvedValue({ steps: [], result: 'ok' });

      await service.stream('task', { onDone: jest.fn() }, 'worker');

      expect(deps.agentLoop.run).toHaveBeenCalledWith('task', 'worker');
    });

    it('skips onChunk when result has no result text', async () => {
      (deps.agentLoop.run as jest.Mock).mockResolvedValue({ steps: [], result: null });

      const onChunk = jest.fn();
      const onDone = jest.fn();

      await service.stream('task', { onChunk, onDone });

      expect(onChunk).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalled();
    });

    it('handles optional callbacks gracefully', async () => {
      (deps.agentLoop.run as jest.Mock).mockResolvedValue({
        steps: [{ phase: 'p', action: 'a', url: null }],
        result: 'text',
      });

      await expect(
        service.stream('task', {}),
      ).resolves.toBeUndefined();
    });
  });

  describe('stream() error handling', () => {
    it('calls onError with Error message when agentLoop.run throws an Error', async () => {
      (deps.agentLoop.run as jest.Mock).mockRejectedValue(new Error('boom'));

      const onError = jest.fn();
      const onDone = jest.fn();
      const onProgress = jest.fn();

      await service.stream('task', { onError, onDone, onProgress });

      expect(onError).toHaveBeenCalledWith('boom');
      expect(onDone).not.toHaveBeenCalled();
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('calls onError with "Unknown error" for non-Error throws', async () => {
      (deps.agentLoop.run as jest.Mock).mockRejectedValue('string error');

      const onError = jest.fn();

      await service.stream('task', { onError });

      expect(onError).toHaveBeenCalledWith('Unknown error');
    });

    it('does not throw when onError callback is not provided', async () => {
      (deps.agentLoop.run as jest.Mock).mockRejectedValue(new Error('fail'));

      await expect(
        service.stream('task', {}),
      ).resolves.toBeUndefined();
    });
  });

  describe('cancel()', () => {
    it('calls agentLoop.cancel() and returns { cancelled: true }', async () => {
      const result = await service.cancel();

      expect(deps.agentLoop.cancel).toHaveBeenCalled();
      expect(result).toEqual({ cancelled: true });
    });
  });

  describe('getStatus()', () => {
    it('returns correct shape with tasksCompleted and provider="local"', async () => {
      deps = createMockDeps({ tasksCompleted: 42 });
      service = new LocalAgentService(deps);

      const status = await service.getStatus();

      expect(status).toEqual({
        running: false,
        uptime_secs: 0,
        browser_open: false,
        tasks_completed: 42,
        model: null,
        provider: 'local',
        conversation_messages: 0,
        current_task: null,
        scheduler: { active_jobs: 0, total_jobs: 0 },
        last_result: null,
        queue_size: 0,
      });
    });

    it('reflects tasksCompleted of 0 by default', async () => {
      const status = await service.getStatus();

      expect(status.tasks_completed).toBe(0);
    });
  });
});
