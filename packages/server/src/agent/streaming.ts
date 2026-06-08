/**
 * Streaming event system for real-time agent updates
 *
 * Provides a clean interface for agents to emit events during execution
 * that can be forwarded to the TUI via RPC notifications.
 */

import type { StepEvent } from '../core/types';

/**
 * Event types that can be streamed during agent execution
 */
export type StreamEventType =
  | 'step_start'
  | 'step_complete'
  | 'step_error'
  | 'thinking'
  | 'content'
  | 'progress'
  | 'error'
  | 'intervention'
  | 'browser_open_required';

/**
 * Base interface for all streaming events
 */
export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
}

/**
 * Step start event - emitted when a tool/action starts
 */
export interface StepStartEvent extends StreamEvent {
  type: 'step_start';
  phase: 'planning' | 'executing' | 'done';
  action: string;
  detail: string;
  url?: string;
}

/**
 * Step complete event - emitted when a step completes
 */
export interface StepCompleteEvent extends StreamEvent {
  type: 'step_complete';
  phase: 'planning' | 'executing' | 'done';
  action: string;
  observation?: string;
  success: boolean;
}

/**
 * Thinking event - emitted during LLM reasoning
 */
export interface ThinkingEvent extends StreamEvent {
  type: 'thinking';
  content: string;
  phase: 'thinking' | 'planning' | 'reflection';
}

/**
 * Content event - emitted when streaming response content
 */
export interface ContentEvent extends StreamEvent {
  type: 'content';
  content: string;
  isFinal: boolean;
}

/**
 * Progress event - emitted for general progress updates
 */
export interface ProgressEvent extends StreamEvent {
  type: 'progress';
  iteration: number;
  maxIterations: number;
  phase: string;
}

/**
 * Error event - emitted when an error occurs
 */
export interface ErrorEvent extends StreamEvent {
  type: 'error';
  error: string;
  recoverable: boolean;
}

export interface InterventionEvent extends StreamEvent {
  type: 'intervention';
  message: string;
  id: number;
}

/**
 * Browser open required event - emitted when agent needs browser panel
 */
export interface BrowserOpenRequiredEvent extends StreamEvent {
  type: 'browser_open_required';
  reason: string;
  task: string;
}

export type AgentStreamEvent =
  | StepStartEvent
  | StepCompleteEvent
  | ThinkingEvent
  | ContentEvent
  | ProgressEvent
  | ErrorEvent
  | InterventionEvent
  | BrowserOpenRequiredEvent;

/**
 * Listener for streaming events
 */
export type StreamEventListener = (event: AgentStreamEvent) => void;

/**
 * Stream emitter - allows agents to emit events during execution
 */
export class StreamEmitter {
  private listeners: Set<StreamEventListener> = new Set();
  private eventQueue: AgentStreamEvent[] = [];
  private batchSize: number;
  private flushIntervalMs: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(options: { batchSize?: number; flushIntervalMs?: number } = {}) {
    this.batchSize = options.batchSize ?? 10;
    this.flushIntervalMs = options.flushIntervalMs ?? 50;
  }

  /**
   * Subscribe to streaming events
   */
  onEvent(listener: StreamEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit a step start event
   */
  emitStepStart(phase: StepStartEvent['phase'], action: string, detail: string, url?: string): void {
    this.emit({
      type: 'step_start',
      timestamp: Date.now(),
      phase,
      action,
      detail,
      url,
    });
  }

  /**
   * Emit a step complete event
   */
  emitStepComplete(
    phase: StepCompleteEvent['phase'],
    action: string,
    observation: string | undefined,
    success: boolean
  ): void {
    this.emit({
      type: 'step_complete',
      timestamp: Date.now(),
      phase,
      action,
      observation,
      success,
    });
  }

  /**
   * Emit a thinking event
   */
  emitThinking(content: string, phase: ThinkingEvent['phase'] = 'thinking'): void {
    this.emit({
      type: 'thinking',
      timestamp: Date.now(),
      content,
      phase,
    });
  }

  /**
   * Emit a content event (for streaming response text)
   */
  emitContent(content: string, isFinal = false): void {
    this.emit({
      type: 'content',
      timestamp: Date.now(),
      content,
      isFinal,
    });
  }

  /**
   * Emit a progress event
   */
  emitProgress(iteration: number, maxIterations: number, phase: string): void {
    this.emit({
      type: 'progress',
      timestamp: Date.now(),
      iteration,
      maxIterations,
      phase,
    });
  }

  /**
   * Emit an error event
   */
  emitError(error: string, recoverable = true): void {
    this.emit({
      type: 'error',
      timestamp: Date.now(),
      error,
      recoverable,
    });
  }

  emitIntervention(message: string, id: number): void {
    this.emit({
      type: 'intervention',
      timestamp: Date.now(),
      message,
      id,
    });
  }

  /**
   * Emit a browser open required event
   */
  emitBrowserOpenRequired(reason: string, task: string): void {
    this.emit({
      type: 'browser_open_required',
      timestamp: Date.now(),
      reason,
      task,
    });
  }

  /**
   * Internal emit method
   */
  private emit(event: AgentStreamEvent): void {
    // Add to queue
    this.eventQueue.push(event);

    // Flush if we've reached batch size
    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    } else {
      // Schedule a flush if not already scheduled
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flush();
        }, this.flushIntervalMs);
      }
    }
  }

  /**
   * Flush queued events to listeners
   */
  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0);
    for (const listener of this.listeners) {
      for (const event of events) {
        try {
          listener(event);
        } catch (err) {
          // Don't let one listener error break others
          console.error('Error in stream listener:', err);
        }
      }
    }
  }

  /**
   * Flush any remaining events and clean up
   */
  destroy(): void {
    this.flush();
    this.listeners.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

/**
 * Convert streaming events to StepEvent for backward compatibility
 */
export function streamEventToStepEvent(event: StepStartEvent | StepCompleteEvent): StepEvent {
  if (event.type === 'step_start') {
    return {
      phase: event.phase,
      action: event.action,
      detail: event.detail,
      url: event.url,
    };
  } else {
    return {
      phase: event.phase,
      action: event.action,
      detail: event.observation ?? '',
    };
  }
}

/**
 * Convert streaming event to RPC notification params
 */
export function streamEventToNotification(event: AgentStreamEvent): Record<string, unknown> {
  switch (event.type) {
    case 'step_start':
      return {
        phase: event.phase,
        action: event.action,
        detail: event.detail,
        url: event.url,
      };
    case 'step_complete':
      return {
        phase: event.phase,
        action: event.action,
        observation: event.observation,
        success: event.success,
      };
    case 'thinking':
      return {
        content: event.content,
        phase: event.phase,
      };
    case 'content':
      return {
        content: event.content,
        is_final: event.isFinal,
      };
    case 'progress':
      return {
        iteration: event.iteration,
        max_iterations: event.maxIterations,
        phase: event.phase,
      };
    case 'error':
      return {
        error: event.error,
        recoverable: event.recoverable,
      };
    case 'intervention':
      return {
        message: event.message,
        id: event.id,
      };
    case 'browser_open_required':
      return {
        reason: event.reason,
        task: event.task,
      };
    default:
      return {};
  }
}
