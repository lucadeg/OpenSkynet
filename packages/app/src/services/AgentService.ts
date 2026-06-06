import { z } from 'zod';
import { apiPost, apiGet, apiStream } from './apiClient';
import {
  AgentError,
  NetworkError,
  isAppError,
} from '@/errors';

export const StepEventSchema = z.object({
  step: z.number(),
  action: z.string(),
  observation: z.string(),
  phase: z.string(),
});

export type StepEvent = z.infer<typeof StepEventSchema>;

export const AgentResultSchema = z.object({
  task: z.string(),
  result: z.string(),
  success: z.boolean(),
  steps: z.array(StepEventSchema),
  skill_created: z.string().nullable(),
  actions_taken: z.array(z.any()),
  scheduled_job_id: z.string().nullable(),
  schedule_cron: z.string().nullable(),
  iterations: z.number(),
  strategy_used: z.string(),
  elapsed_secs: z.number(),
});

export type AgentResult = z.infer<typeof AgentResultSchema>;

export const StreamChunkSchema = z.object({
  type: z.enum(['chunk', 'progress', 'done', 'error']),
  streamId: z.string().optional(),
  data: z.union([
    z.object({
      delta: z.string(),
      phase: z.string().optional(),
    }),
    z.any(),
  ]),
});

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

export const StreamProgressSchema = z.object({
  type: z.literal('progress'),
  data: z.object({
    phase: z.string(),
    action: z.string(),
    url: z.string().optional(),
    step: z.number(),
  }),
});

export type StreamProgress = z.infer<typeof StreamProgressSchema>;

export interface StreamCallbacks {
  onChunk: (delta: string, phase?: string) => void;
  onProgress?: (progress: {
    phase: string;
    action: string;
    url?: string;
    step: number;
  }) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export interface AgentService {
  run(task: string, mode?: string): Promise<AgentResult>;
  stream(task: string, callbacks: StreamCallbacks, mode?: string): Promise<void>;
  cancel(): Promise<{ cancelled: boolean }>;
  getStatus(): Promise<AgentStatus>;
}

export interface AgentStatus {
  running: boolean;
  uptime_secs: number;
  browser_open: boolean;
  tasks_completed: number;
  model: string | null;
  provider: string;
  conversation_messages: number;
  current_task: string | null;
  scheduler: {
    active_jobs: number;
    total_jobs: number;
  };
  last_result: {
    task_id: string;
    task: string;
    result: string;
  } | null;
  queue_size: number;
}

export class HttpAgentService implements AgentService {
  async run(task: string, mode = 'manager'): Promise<AgentResult> {
    try {
      const response = await apiPost<AgentResult>('/api/agent/run', { task, mode });
      const validated = AgentResultSchema.safeParse(response);
      if (!validated.success) {
        throw new NetworkError('Invalid response from agent.run');
      }
      return validated.data;
    } catch (error) {
      if (isAppError(error)) throw error;
      if (error instanceof Error) {
        throw new NetworkError(error.message);
      }
      throw new NetworkError('Unknown error in agent.run');
    }
  }

  async stream(
    task: string,
    callbacks: StreamCallbacks,
    mode = 'manager'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let isDone = false;

      apiStream(
        '/api/agent/run',
        { task, mode },
        (type, data) => {
          switch (type) {
            case 'chunk':
              callbacks.onChunk(data.delta, data.phase);
              break;
            case 'progress':
              callbacks.onProgress?.(data);
              break;
            case 'done':
              if (!isDone) {
                isDone = true;
                callbacks.onDone?.();
                resolve();
              }
              break;
            case 'error':
              if (!isDone) {
                isDone = true;
                const errMsg = data.error || 'Unknown error';
                callbacks.onError?.(errMsg);
                reject(new AgentError(errMsg));
              }
              break;
          }
        },
        () => {
          if (!isDone) {
            isDone = true;
            callbacks.onDone?.();
            resolve();
          }
        },
        (err) => {
          if (!isDone) {
            isDone = true;
            callbacks.onError?.(err.message);
            reject(err);
          }
        }
      );
    });
  }

  async cancel(): Promise<{ cancelled: boolean }> {
    try {
      return await apiPost<{ cancelled: boolean }>('/api/agent/cancel');
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to cancel agent');
    }
  }

  async getStatus(): Promise<AgentStatus> {
    try {
      return await apiGet<AgentStatus>('/api/agent/status');
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to get agent status');
    }
  }
}

export function createAgentService(): AgentService {
  return new HttpAgentService();
}
