import type { LocalServerDeps } from './LocalAgentService';

export type BackendMode = 'local' | 'rpc';

export interface BackendConfig {
  mode: BackendMode;
  rpcUrl?: string;
  localDeps?: LocalServerDeps;
}

let backendConfig: BackendConfig = { mode: 'rpc' };

export function configureBackend(config: BackendConfig): void {
  backendConfig = config;
}

export function getBackendConfig(): BackendConfig {
  return backendConfig;
}

export function isLocalMode(): boolean {
  return backendConfig.mode === 'local' && !!backendConfig.localDeps;
}

export function getLocalDeps(): LocalServerDeps | undefined {
  return backendConfig.localDeps;
}
