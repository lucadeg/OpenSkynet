/**
 * Enhanced AgentLoop with Structured Output
 *
 * Replaces the basic agent loop with guaranteed structured output,
 * better error handling, and integration with smart perception layer
 *
 * @module agent/execution/enhanced-loop
 */

import type { LLMProvider } from '../../llm/provider';
import type { BaseMemoryStrategy } from '../../memory/strategy';
import type { SkillEngine } from '../../skills/engine';
import type { BrowserSession, PageState } from '../../browser';
import { ToolBus } from '../tools/bus';
import { StreamEmitter } from '../streaming';
import { getConfig } from '../../core/config';
import { createLogger } from '../../core/logging';
import {
  AgentResponseSchema,
  AgentResponse,
  AgentThought,
  validateAgentResponse,
  coerceAgentResponse,
  createSuccessResponse,
  createFailureResponse,
  ToolCall
} from '../schemas';
import { VisionDOMFusion, FusionState } from '../../browser/perception';
import type { StructuredLLMProvider } from '../../llm/structured';

const logger = createLogger('enhanced-agent-loop');

// ============================================================================
// Type Definitions
// ============================================================================

export interface EnhancedAgentLoopOpts {
  llmProvider: LLMProvider;
  structuredLLMProvider?: StructuredLLMProvider;
  browserSession?: BrowserSession;
  memory?: BaseMemoryStrategy;
  skillEngine?: SkillEngine;
  toolBus?: ToolBus;
  headless?: boolean;
  workingDirectory?: string;
  useVision?: boolean;
  useSmartPerception?: boolean;
  maxIterations?: number;
}

export interface EnhancedAgentResult {
  task: string;
  result: string;
  success: boolean;
  actions_taken: string[];
  iterations: number;
  strategy_used: string;
  elapsed_secs: number;
  final_response?: AgentResponse;
  error?: string;
}

interface StepEvent {
  phase: string;
  action: string;
  detail?: string;
  observation?: string;
}

// ============================================================================
// Enhanced Agent Loop
// ============================================================================

export class EnhancedAgentLoop {
  private llmProvider: LLMProvider;
  private structuredLLMProvider?: StructuredLLMProvider;
  private browserSession?: BrowserSession;
  private memory?: BaseMemoryStrategy;
  private skillEngine?: SkillEngine;
  private toolBus: ToolBus;
  private streamEmitter: StreamEmitter;
  private visionFusion?: VisionDOMFusion;

  private conversation: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string | Array<{ type: string; [key: string]: any }>; tool_call_id?: string; name?: string }> = [];
  private maxIterations: number;
  private agentMemory = '';
  private consecutiveFailures = 0;
  private cancelled = false;
  private useVision: boolean;
  private useSmartPerception: boolean;
  private workingDirectory: string;

  constructor(opts: EnhancedAgentLoopOpts) {
    const config = getConfig();

    this.llmProvider = opts.llmProvider;
    this.structuredLLMProvider = opts.structuredLLMProvider;
    this.browserSession = opts.browserSession;
    this.memory = opts.memory;
    this.skillEngine = opts.skillEngine;
    this.toolBus = opts.toolBus || new ToolBus();
    this.streamEmitter = new StreamEmitter({ batchSize: 10, flushIntervalMs: 50 });
    this.useVision = opts.useVision ?? true;
    this.useSmartPerception = opts.useSmartPerception ?? false;
    this.workingDirectory = opts.workingDirectory ?? process.cwd();
    // Ensure at least 50 iterations
    const calculatedMax = config.compressThreshold * 2 + 10;
    this.maxIterations = opts.maxIterations ?? Math.max(calculatedMax, 50);

    if (this.useSmartPerception && this.browserSession) {
      this.visionFusion = new VisionDOMFusion();
      logger.info('[EnhancedAgentLoop] Smart perception enabled');
    }
  }

  /**
   * Set structured LLM provider
   */
  setStructuredLLMProvider(provider: StructuredLLMProvider): void {
    this.structuredLLMProvider = provider;
    logger.info('[EnhancedAgentLoop] Structured LLM provider set');
  }

  /**
   * Enable smart perception
   */
  enableSmartPerception(): void {
    this.useSmartPerception = true;
    if (!this.visionFusion) {
      this.visionFusion = new VisionDOMFusion();
    }
    logger.info('[EnhancedAgentLoop] Smart perception enabled');
  }

  /**
   * Run the agent loop with structured output
   */
  async run(task: string, mode?: string): Promise<EnhancedAgentResult> {
    const startTime = Date.now();
    const actionsTaken: string[] = [];
    const steps: StepEvent[] = [];
    let iteration = 0;
    let finalResult = '';
    let success = false;
    let finalResponse: AgentResponse | undefined;

    try {
      this.cancelled = false;
      this.agentMemory = '';
      this.conversation = [] as typeof this.conversation;

      if (this.memory) {
        await this.memory.onTurnStart();
      }

      this.streamEmitter.emitProgress(0, this.maxIterations, 'starting');

      // Capture initial state
      const initialState = await this.captureState();
      const initialMsg = this.buildStateMessage(task, initialState);
      this.conversation.push(initialMsg);

      while (iteration < this.maxIterations && !this.cancelled) {
        iteration++;
        this.streamEmitter.emitProgress(iteration, this.maxIterations, 'thinking');

        // Build system prompt
        const systemPrompt = this.buildSystemPrompt(task, mode);

        // Get LLM response with structured output
        let response: AgentResponse;

        try {
          if (this.structuredLLMProvider) {
            // Use structured output provider
            const result = await this.structuredLLMProvider.chatStructured(
              this.conversation,
              AgentResponseSchema,
              systemPrompt,
              { temperature: 0.7, maxTokens: 4096 }
            );
            response = result.data;
            logger.info({ usage: result.usage }, '[EnhancedAgentLoop] Structured LLM response received');
          } else {
            // Fallback to regular LLM with parsing
            response = await this.getStructuredResponseFromLLM(systemPrompt);
          }
        } catch (error) {
          logger.error({ err: error as Error, iteration }, '[EnhancedAgentLoop] LLM error');

          // Try to coerce response
          response = coerceAgentResponse({
            thought: {
              thinking: 'Error occurred, retrying',
              evaluation: 'failure',
              memory: this.agentMemory,
              nextGoal: 'Continue task'
            },
            actions: [],
            done: false
          });
        }

        finalResponse = response;

        // Update memory from response
        if (response.thought?.memory) {
          this.agentMemory = response.thought.memory;
        }

        // Emit thinking
        if (response.thought?.thinking) {
          this.streamEmitter.emitThinking(response.thought.thinking, 'thinking');
        }

        // Add assistant response to conversation
        this.conversation.push({
          role: 'assistant',
          content: JSON.stringify(response)
        });

        // Check if done
        if (response.done) {
          finalResult = response.summary || response.thought?.memory || 'Task completed';
          success = response.thought?.evaluation?.toLowerCase().includes('success') ||
                   actionsTaken.length > 0;
          break;
        }

        // Execute actions
        if (response.actions && response.actions.length > 0) {
          let anySuccess = false;
          let combinedOutput = '';

          for (const action of response.actions) {
            this.streamEmitter.emitStepStart('executing', action.name, JSON.stringify(action.arguments));

            try {
              const result = await this.toolBus.execute(action.name, action.arguments);

              if (result.success) {
                anySuccess = true;
                combinedOutput += `[${action.name}]: ${result.output}\n`;
                actionsTaken.push(`${action.name}: success`);
                this.consecutiveFailures = 0;
              } else {
                combinedOutput += `[${action.name}] FAILED: ${result.error || 'Unknown error'}\n`;
                actionsTaken.push(`${action.name}: failed`);
                this.consecutiveFailures++;
              }

              this.streamEmitter.emitStepComplete(
                'executing',
                action.name,
                result.success ? (result.output || 'Success') : (result.error || 'Failed'),
                result.success
              );
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              combinedOutput += `[${action.name}] ERROR: ${errMsg}\n`;
              actionsTaken.push(`${action.name}: error`);
              this.consecutiveFailures++;

              this.streamEmitter.emitStepComplete('executing', action.name, errMsg, false);
            }
          }

          // Capture new state after actions
          if (!this.cancelled) {
            await new Promise(resolve => setTimeout(resolve, 500));

            const newState = await this.captureState();
            const stateMsg = this.buildStateMessage(
              `Continue working on: ${task}`,
              newState
            );

            // Inject action results
            if (typeof stateMsg.content === 'string') {
              stateMsg.content = `<action_results>\n${combinedOutput.trim()}\n</action_results>\n\n${stateMsg.content}`;
            }

            this.conversation.push(stateMsg);
          }

          // Check if browser_end was called - if so, the agent has completed the task
          if (actionsTaken.includes('browser_end')) {
            logger.info('[EnhancedAgentLoop] Agent called browser_end - stopping loop');
            break;
          }

          // Check for failure loop
          if (!anySuccess && this.consecutiveFailures >= 3) {
            this.conversation.push({
              role: 'user',
              content: '<reflection>Multiple consecutive failures. The previous actions did not succeed. Try a completely different approach.</reflection>'
            });
          }
        } else {
          // No actions - prompt to continue
          this.conversation.push({
            role: 'user',
            content: 'Please continue. Take the next action to complete the task.'
          });
        }

        // Budget warning at 75%
        if (iteration >= this.maxIterations * 0.75) {
          this.conversation.push({
            role: 'user',
            content: `<budget_warning>You have used ${iteration}/${this.maxIterations} steps. Focus on wrapping up.</budget_warning>`
          });
        }
      }

      if (!finalResult && !this.cancelled) {
        finalResult = this.agentMemory || 'Task execution ended';
        success = actionsTaken.length > 0;
      }

      if (this.memory) {
        await this.memory.onSessionEnd();
      }

      return {
        task,
        result: finalResult || 'Task completed',
        success,
        actions_taken: actionsTaken,
        iterations: iteration,
        strategy_used: this.useSmartPerception ? 'smart_perception' : 'standard',
        elapsed_secs: Math.round((Date.now() - startTime) / 1000),
        final_response: finalResponse
      };
    } catch (error) {
      logger.error({ err: error as Error }, '[EnhancedAgentLoop] Fatal error');

      return {
        task,
        result: error instanceof Error ? error.message : String(error),
        success: false,
        actions_taken: actionsTaken,
        iterations: iteration,
        strategy_used: 'error',
        elapsed_secs: Math.round((Date.now() - startTime) / 1000),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    this.cancelled = true;
    this.streamEmitter.emitError('Task cancelled', false);
  }

  /**
   * Subscribe to stream events
   */
  onStreamEvent(listener: (event: any) => void): () => void {
    return this.streamEmitter.onEvent(listener);
  }

  /**
   * Get conversation history
   */
  getConversation(): Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string | Array<{ type: string; [key: string]: any }>; tool_call_id?: string; name?: string }> {
    return [...this.conversation];
  }

  /**
   * Set conversation history
   */
  setConversation(messages: Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string | Array<{ type: string; [key: string]: any }>; tool_call_id?: string; name?: string }>): void {
    this.conversation = [...messages];
  }

  /**
   * Clear conversation
   */
  clearConversation(): void {
    this.conversation = [] as typeof this.conversation;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Capture current browser state
   */
  private async captureState(): Promise<PageState | { formatted: string; screenshot: string | null; url: string; title: string }> {
    if (!this.browserSession) {
      return { formatted: '', screenshot: null, url: '', title: '' };
    }

    try {
      const page = this.browserSession.context?.pages()[0];
      if (!page) {
        return { formatted: '', screenshot: null, url: '', title: '' };
      }

      if (this.useSmartPerception && this.visionFusion) {
        // Use smart perception (AX + Vision fusion)
        const fusedState = await this.visionFusion.captureFusedState(page, {
          includeScreenshot: this.useVision,
          screenshotQuality: 'auto',
          fusionStrategy: 'balanced'
        });

        return {
          formatted: fusedState.dom.formatted,
          screenshot: fusedState.screenshot.data,
          url: fusedState.dom.state.url,
          title: fusedState.dom.state.title
        };
      } else {
        // Legacy method
        const screenshot = this.useVision ? await this.browserSession.takeScreenshot() : null;
        const url = page.url();
        const title = await page.title();

        return {
          formatted: `URL: ${url}\nTitle: ${title}`,
          screenshot,
          url,
          title
        };
      }
    } catch (error) {
      logger.error({ err: error as Error }, '[EnhancedAgentLoop] Failed to capture state');
      return { formatted: '', screenshot: null, url: '', title: '' };
    }
  }

  /**
   * Build state message for LLM
   */
  private buildStateMessage(
    task: string,
    state: PageState | { formatted: string; screenshot: string | null; url: string; title: string }
  ): { role: 'user'; content: string | Array<{ type: string; [key: string]: any }> } {
    const formatted = 'formatted' in state ? state.formatted : JSON.stringify(state);
    const textContent = `<user_request>\n${task}\n</user_request>\n\n<agent_memory>\n${this.agentMemory || '(no memory yet)'}\n</agent_memory>\n\n<browser_state>\nCurrent URL: ${state.url}\n${formatted}\n</browser_state>`;

    const screenshot = (state as any).screenshot;
    if (this.useVision && screenshot && screenshot.length > 100) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: textContent },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${screenshot}`,
              detail: 'auto'
            }
          }
        ]
      };
    }

    return { role: 'user', content: textContent };
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(task: string, mode?: string): string {
    const basePrompt = `You are an AI agent that operates a web browser to accomplish tasks using structured output.

<output_format>
You MUST respond with a JSON object matching this schema:
{
  "thought": {
    "thinking": "Your reasoning about current state and actions",
    "evaluation": "success|failure|uncertain - evaluate previous action",
    "memory": "1-3 sentences tracking progress",
    "nextGoal": "One clear sentence for what to accomplish next"
  },
  "actions": [
    {
      "name": "tool_name",
      "arguments": { ... }
    }
  ],
  "done": false,
  "summary": "Final summary when done=true"
}
</output_format>

<workflow>
1. OBSERVE - Check the page state (URL + elements + screenshot if available)
2. THINK - Reason about what you see and what to do
3. ACT - Call appropriate tools (browser_navigate, browser_click, browser_type, etc.)
4. VERIFY - Check results and continue until task complete
</workflow>

<task_completion>
Set done=true when:
- Task is fully completed
- Impossible to continue
- Reached iteration limit

Set summary to all relevant findings when done=true.
</task_completion>`;

    if (mode === 'browser') {
      return basePrompt + `

<browser_tools>
Available tools:
- browser_navigate(url) - Go to URL
- browser_snapshot() - Get page elements
- browser_click(refId) - Click element by ID
- browser_type(refId, text) - Type into element
- browser_scroll(direction) - Scroll page
- browser_press_key(key) - Press keyboard key
- browser_end(summary) - Complete task
</browser_tools>`;
    }

    return basePrompt;
  }

  /**
   * Get structured response from regular LLM (fallback)
   */
  private async getStructuredResponseFromLLM(systemPrompt: string): Promise<AgentResponse> {
    // Get tools
    const tools = this.toolBus.getDefinitions();

    // Call LLM
    const response = await this.llmProvider.chat(this.conversation, tools, systemPrompt);

    // Try to parse as JSON first
    try {
      if (response.text) {
        const parsed = JSON.parse(response.text);
        const validated = AgentResponseSchema.safeParse(parsed);
        if (validated.success) {
          return validated.data;
        }
      }
    } catch {}

    // Fallback to coercion
    return coerceAgentResponse({
      thought: {
        thinking: response.text?.slice(0, 500) || 'No reasoning',
        evaluation: 'uncertain',
        memory: this.agentMemory,
        nextGoal: 'Continue'
      },
      actions: response.tool_calls?.map((tc: any) => ({
        name: tc.name,
        arguments: tc.arguments
      })) || [],
      done: !!response.done,
      summary: response.text
    });
  }
}

/**
 * Create enhanced agent loop
 */
export function createEnhancedAgentLoop(opts: EnhancedAgentLoopOpts): EnhancedAgentLoop {
  return new EnhancedAgentLoop(opts);
}
