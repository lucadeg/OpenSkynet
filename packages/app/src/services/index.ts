export type { AgentService, AgentStatus, StreamCallbacks } from './AgentService';
export type { SkillsService, CreateSkillInput, Skill, HubSkill } from './SkillsService';
export type { MemoryService, MemoryData, MemoryEntry } from './MemoryService';
export type { SandboxService } from './SandboxService';
export type { SandboxSession, SandboxStatus, InputEvent, StreamCallback as SandboxStreamCallback } from '@/types/sandbox';
export type { LocalServerDeps } from './LocalAgentService';
export type { BackendMode, BackendConfig } from './ServerBridge';

export { createAgentService } from './AgentService';
export { createSkillsService } from './SkillsService';
export { createMemoryService } from './MemoryService';
export { createSandboxService } from './SandboxService';
export { LocalAgentService } from './LocalAgentService';
export { LocalSkillsService } from './LocalSkillsService';
export { LocalMemoryService } from './LocalMemoryService';
export { configureBackend, getBackendConfig, isLocalMode, getLocalDeps } from './ServerBridge';

import type { AgentService } from './AgentService';
import type { SkillsService } from './SkillsService';
import type { MemoryService } from './MemoryService';
import type { SandboxService } from './SandboxService';
import type { LocalServerDeps } from './LocalAgentService';
import { createAgentService } from './AgentService';
import { createSkillsService } from './SkillsService';
import { createMemoryService } from './MemoryService';
import { createSandboxService } from './SandboxService';
import { LocalAgentService } from './LocalAgentService';
import { LocalSkillsService } from './LocalSkillsService';
import { LocalMemoryService } from './LocalMemoryService';

export class ServiceContainer {
  private _agent?: AgentService;
  private _skills?: SkillsService;
  private _memory?: MemoryService;
  private _sandbox?: SandboxService;
  private localDeps: LocalServerDeps | null;

  constructor(backend?: LocalServerDeps | any) {
    if (backend && typeof backend === 'object' && 'agentLoop' in backend) {
      this.localDeps = backend as LocalServerDeps;
    } else {
      this.localDeps = null;
    }
  }

  get agent(): AgentService {
    if (!this._agent) {
      if (this.localDeps) {
        this._agent = new LocalAgentService(this.localDeps);
      } else {
        this._agent = createAgentService();
      }
    }
    return this._agent!;
  }

  get skills(): SkillsService {
    if (!this._skills) {
      if (this.localDeps) {
        this._skills = new LocalSkillsService(this.localDeps);
      } else {
        this._skills = createSkillsService();
      }
    }
    return this._skills!;
  }

  get memory(): MemoryService {
    if (!this._memory) {
      if (this.localDeps) {
        this._memory = new LocalMemoryService(this.localDeps.memory);
      } else {
        this._memory = createMemoryService();
      }
    }
    return this._memory!;
  }

  get sandbox(): SandboxService {
    if (!this._sandbox) {
      this._sandbox = createSandboxService();
    }
    return this._sandbox;
  }

  reset(): void {
    this._agent = undefined;
    this._skills = undefined;
    this._memory = undefined;
    this._sandbox = undefined;
  }
}

export function createServiceContainer(backend?: LocalServerDeps | any): ServiceContainer {
  return new ServiceContainer(backend);
}
