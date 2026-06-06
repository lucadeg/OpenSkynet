import type { AgentService, AgentResult, AgentStatus, StreamCallbacks } from './AgentService';

export interface LocalServerDeps {
  agentLoop: any;
  skillEngine: any;
  memory: any;
  hubClient: any;
  gitHubInstaller: any;
  skillSearch: any;
  cronManager: any;
  changelog: any;
  checkpointManager: any;
  browserSession: any;
  browserController: any;
  llmProvider: any;
  headless: boolean;
  sandboxMode: string;
  tasksCompleted: number;
  terminalAllowed: boolean;
  activeRecording: { id: string; name: string; status: string } | null;
}

export class LocalAgentService implements AgentService {
  constructor(private deps: LocalServerDeps) {}

  async run(task: string, mode = 'manager'): Promise<AgentResult> {
    const result = await this.deps.agentLoop.run(task, mode);
    return result as AgentResult;
  }

  async stream(task: string, callbacks: StreamCallbacks, mode = 'manager'): Promise<void> {
    try {
      const result = await this.deps.agentLoop.run(task, mode);

      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];
        callbacks.onProgress?.({
          phase: step.phase,
          action: step.action,
          url: step.url,
          step: i,
        });
      }

      if (result.result) {
        callbacks.onChunk(result.result, 'done');
      }
      callbacks.onDone?.();
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async cancel(): Promise<{ cancelled: boolean }> {
    this.deps.agentLoop.cancel();
    return { cancelled: true };
  }

  async getStatus(): Promise<AgentStatus> {
    return {
      running: false,
      uptime_secs: 0,
      browser_open: false,
      tasks_completed: this.deps.tasksCompleted,
      model: null,
      provider: 'local',
      conversation_messages: 0,
      current_task: null,
      scheduler: { active_jobs: 0, total_jobs: 0 },
      last_result: null,
      queue_size: 0,
    };
  }
}
