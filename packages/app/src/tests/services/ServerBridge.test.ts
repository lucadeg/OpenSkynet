import {
  configureBackend,
  getBackendConfig,
  isLocalMode,
  getLocalDeps,
} from '@/services/ServerBridge';

const mockLocalDeps = {
  someDep: 'value',
} as any;

afterEach(() => {
  configureBackend({ mode: 'rpc' });
});

describe('ServerBridge', () => {
  describe('default state', () => {
    it('getBackendConfig returns { mode: "rpc" }', () => {
      const config = getBackendConfig();
      expect(config).toEqual({ mode: 'rpc' });
    });

    it('isLocalMode returns false', () => {
      expect(isLocalMode()).toBe(false);
    });

    it('getLocalDeps returns undefined', () => {
      expect(getLocalDeps()).toBeUndefined();
    });
  });

  describe('configureBackend with local mode and localDeps', () => {
    it('isLocalMode returns true', () => {
      configureBackend({ mode: 'local', localDeps: mockLocalDeps });
      expect(isLocalMode()).toBe(true);
    });

    it('getLocalDeps returns the provided deps', () => {
      configureBackend({ mode: 'local', localDeps: mockLocalDeps });
      expect(getLocalDeps()).toBe(mockLocalDeps);
    });

    it('getBackendConfig returns the full config', () => {
      const config = { mode: 'local' as const, localDeps: mockLocalDeps };
      configureBackend(config);
      expect(getBackendConfig()).toEqual(config);
    });
  });

  describe('configureBackend with local mode but no localDeps', () => {
    it('isLocalMode returns false', () => {
      configureBackend({ mode: 'local' });
      expect(isLocalMode()).toBe(false);
    });

    it('getLocalDeps returns undefined', () => {
      configureBackend({ mode: 'local' });
      expect(getLocalDeps()).toBeUndefined();
    });
  });

  describe('configureBackend with rpc mode', () => {
    it('isLocalMode returns false', () => {
      configureBackend({ mode: 'rpc' });
      expect(isLocalMode()).toBe(false);
    });
  });

  describe('switching modes', () => {
    it('transitions from local to rpc correctly', () => {
      configureBackend({ mode: 'local', localDeps: mockLocalDeps });
      expect(isLocalMode()).toBe(true);
      expect(getLocalDeps()).toBe(mockLocalDeps);

      configureBackend({ mode: 'rpc' });
      expect(isLocalMode()).toBe(false);
      expect(getLocalDeps()).toBeUndefined();
      expect(getBackendConfig()).toEqual({ mode: 'rpc' });
    });

    it('transitions from rpc to local correctly', () => {
      configureBackend({ mode: 'rpc' });
      expect(isLocalMode()).toBe(false);

      configureBackend({ mode: 'local', localDeps: mockLocalDeps });
      expect(isLocalMode()).toBe(true);
      expect(getLocalDeps()).toBe(mockLocalDeps);
    });
  });

  describe('with rpcUrl', () => {
    it('stores the rpcUrl in config', () => {
      configureBackend({ mode: 'rpc', rpcUrl: 'http://localhost:8080' });
      expect(getBackendConfig()).toEqual({
        mode: 'rpc',
        rpcUrl: 'http://localhost:8080',
      });
    });

    it('isLocalMode returns false with rpcUrl', () => {
      configureBackend({ mode: 'rpc', rpcUrl: 'http://localhost:8080' });
      expect(isLocalMode()).toBe(false);
    });
  });
});
