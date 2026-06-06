/**
 * BrowserAgent - Optimized browser-first agent
 *
 * Based on kimi-code architecture with:
 * - Better prompts and tool descriptions
 * - Proper reflection and self-correction
 * - Retry logic with exponential backoff
 * - Structured output formatting
 * - Tool access tracking
 */

import type { AgentResult, StepEvent, ToolDefinition } from '../core/types';
import type { LLMProvider } from '../llm/provider';
import type { BaseMemoryStrategy } from '../memory/strategy';
import type { SkillEngine } from '../skills/engine';
import type { SkillSearchEngine } from '../skills/search';
import type { BrowserController } from '../browser/controller';
import { ToolBus } from './tools/bus';
import { loadSoul } from './prompts/soul';
import { initializeT800Tools } from '../electron/tools';
import { StreamEmitter } from './streaming';
import { getConfig } from '../core/config';

// Types
type Message = { role: string; content: string };
type TaskCategory = 'browser' | 'search' | 'extraction' | 'form' | 'navigation';

// Retry configuration (kimi-code style)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 300; // ms
const MAX_RETRY_DELAY = 5000; // ms
const RETRY_JITTER = 500; // ms

export interface BrowserAgentOpts {
  llmProvider: LLMProvider;
  browserController?: BrowserController;
  memory?: BaseMemoryStrategy;
  skillEngine?: SkillEngine;
  skillSearch?: SkillSearchEngine;
  toolBus?: ToolBus;
  headless?: boolean;
  workingDirectory?: string;
  // Tool enablement
  enableBrowserTools?: boolean;
  enableShellTools?: boolean;
  enableFileTools?: boolean;
  enableCodingTools?: boolean;
  enableWebTools?: boolean;
  enableSkillsTools?: boolean;
}

// Check if error is retryable (kimi-code pattern)
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors, timeouts, rate limiting
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /ECONNREFUSED/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /503/i,
      /502/i,
      /429/i, // rate limiting
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }
  return false;
}

// Calculate retry delay with exponential backoff and jitter
function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, attempt),
    MAX_RETRY_DELAY
  );
  const jitter = Math.random() * RETRY_JITTER;
  return exponentialDelay + jitter;
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Result builder for structured output
class ResultBuilder {
  private parts: string[] = [];
  private hasError = false;

  error(message: string): ResultBuilder {
    this.hasError = true;
    this.parts.push(`❌ Error: ${message}`);
    return this;
  }

  write(message: string): ResultBuilder {
    this.parts.push(message);
    return this;
  }

  writeLine(message: string): ResultBuilder {
    this.parts.push(`${message}\n`);
    return this;
  }

  section(title: string): ResultBuilder {
    this.writeLine(`\n### ${title}\n`);
    return this;
  }

  list(items: string[], title: string = ''): ResultBuilder {
    if (title) this.writeLine(`${title}:`);
    for (const item of items) {
      this.write(`  • ${item}\n`);
    }
    return this;
  }

  code(code: string, language: string = ''): ResultBuilder {
    this.writeLine('```' + language);
    this.write(code);
    this.writeLine('```');
    return this;
  }

  build(): string {
    return this.parts.join('');
  }

  success(result: string): string {
    this.parts.push(`✅ ${result}`);
    return this.parts.join('');
  }

  isEmpty(): boolean {
    return this.parts.length === 0;
  }
}

/**
 * Checkpoint for time-travel functionality (kimi-code style)
 */
interface Checkpoint {
  id: number;
  conversationLength: number;
  timestamp: number;
}

/**
 * BrowserAgent - Optimized browser-first agent
 */
export class BrowserAgent {
  // Core dependencies
  private llmProvider: LLMProvider;
  private browserController: BrowserController | null;
  private memory: BaseMemoryStrategy | null;
  private skillEngine: SkillEngine | null;
  private skillSearch: SkillSearchEngine | null;
  private toolBus: ToolBus;
  private streamEmitter: StreamEmitter;

  // State
  private conversation: Message[] = [];
  private maxIterations: number;
  private soul: string;
  private workingDirectory: string;
  private headless: boolean;
  private cancelled = false;
  private toolsInitialized = false;

  // Checkpoint system (kimi-code style)
  private checkpoints: Checkpoint[] = [];
  private nextCheckpointId = 0;

  // Reflection state
  private consecutiveErrors = 0;
  private lastError: string | null = null;

  // Tool settings
  private enableBrowserTools: boolean;
  private enableShellTools: boolean;
  private enableFileTools: boolean;
  private enableCodingTools: boolean;
  private enableWebTools: boolean;
  private enableSkillsTools: boolean;

  constructor(opts: BrowserAgentOpts) {
    const config = getConfig();
    this.llmProvider = opts.llmProvider;
    this.browserController = opts.browserController ?? null;
    this.memory = opts.memory ?? null;
    this.skillEngine = opts.skillEngine ?? null;
    this.skillSearch = opts.skillSearch ?? null;
    this.toolBus = opts.toolBus ?? new ToolBus();
    this.streamEmitter = new StreamEmitter({ batchSize: 10, flushIntervalMs: 50 });

    this.conversation = [];
    this.maxIterations = config.compressThreshold * 2 + 10;
    this.soul = '';
    this.workingDirectory = opts.workingDirectory ?? process.cwd();
    this.headless = opts.headless ?? true;

    // Tool enablement
    this.enableBrowserTools = opts.enableBrowserTools ?? true;
    this.enableShellTools = opts.enableShellTools ?? true;
    this.enableFileTools = opts.enableFileTools ?? true;
    this.enableCodingTools = opts.enableCodingTools ?? true;
    this.enableWebTools = opts.enableWebTools ?? true;
    this.enableSkillsTools = opts.enableSkillsTools ?? true;

    this.initializeTools();
  }

  // Initialize tools
  private initializeTools(): void {
    if (this.toolsInitialized) return;

    initializeT800Tools(this.toolBus, {
      cwd: this.workingDirectory,
      enableBrowserTools: this.enableBrowserTools,
      enableShellTools: this.enableShellTools,
      enableFileTools: this.enableFileTools,
      enableCodingTools: this.enableCodingTools,
      enableWebTools: this.enableWebTools,
      enableSkillsTools: this.enableSkillsTools,
      enableDocumentTools: false,
      skillDeps: {
        skillEngine: this.skillEngine ?? undefined,
        skillSearch: this.skillSearch ?? undefined,
        runSkill: async (name: string) => {
          if (!this.skillEngine) return null;
          const skill = this.skillEngine.getSkill(name);
          return skill;
        },
      },
    });

    this.toolsInitialized = true;
  }

  /**
   * Create checkpoint (kimi-code time-travel)
   */
  private createCheckpoint(): void {
    const checkpoint: Checkpoint = {
      id: this.nextCheckpointId++,
      conversationLength: this.conversation.length,
      timestamp: Date.now(),
    };
    this.checkpoints.push(checkpoint);
  }

  /**
   * Restore to checkpoint
   */
  private restoreCheckpoint(checkpointId: number): boolean {
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) return false;

    // Truncate conversation to checkpoint point
    this.conversation = this.conversation.slice(0, checkpoint.conversationLength);
    return true;
  }

  /**
   * Build enhanced system prompt with examples (kimi-code style)
   */
  private buildSystemPrompt(): string {
    const toolDescriptions = this.getToolDescriptions();

    return `# Browser Automation Agent

You are an intelligent browser automation agent. Your goal is to complete tasks efficiently and accurately.

${this.soul ? `## Personality\n${this.soul}\n` : ''}

## Available Tools

${toolDescriptions.join('\n')}

## Task Execution Strategy

1. **Understand the Goal** - Read the task carefully and identify what needs to be done
2. **Plan Your Approach** - Break down complex tasks into clear steps
3. **Use Tools Appropriately** - Choose the right tool for each action
4. **Verify Results** - Confirm each action succeeded before proceeding
5. **Adapt and Recover** - If something fails, try an alternative approach
6. **Report Clearly** - Provide a concise summary of what was accomplished

## Guidelines

- **Browser Automation**: Use browser tools to navigate, click, type, and extract data
- **Shell Commands**: Use for system operations when needed
- **File Operations**: Use file tools to read/write files when required
- **Code Editing**: Use coding tools to edit code when required
- **Skills**: Use skills for reusable workflows when applicable
- **Web Access**: Use web tools to fetch URLs and search

## Examples

**Example 1: Checking weather**
Task: "Check the weather in New York"
Response: I'll navigate to a weather website and check New York's weather.
1. Navigate to weather.com
2. Search for "New York"
3. Extract the weather information
4. Report the current temperature and conditions

**Example 2: Filling a form**
Task: "Fill out the contact form with name 'John' and email 'john@example.com'"
Response: I'll navigate to the form and fill it out.
1. Navigate to the form URL
2. Use browser_snapshot to find the input fields
3. Use browser_type to fill in the name field
4. Use browser_type to fill in the email field
5. Submit the form
6. Verify success

**Example 3: Data extraction**
Task: "Get all product names from this page"
Response: I'll extract the product names from the page.
1. Navigate to the page
2. Take a snapshot to identify product elements
3. Use browser_extract_text to get all text content
4. Parse and format the product names
5. Return the list

## Common Patterns

**For navigation tasks:**
1. Navigate to the URL
2. Wait for page to load
3. Take snapshot to understand page structure
4. Extract data or perform actions
5. Verify results

**For form filling:**
1. Navigate to form URL
2. Fill in fields using type tool
3. Submit form
4. Wait for response
5. Extract confirmation

**For data extraction:**
1. Navigate to source
2. Use snapshot to find relevant elements
3. Use extract_text to get content
4. Format and return data

## Error Handling

If a tool fails:
1. Analyze the error message
2. Try an alternative approach
3. Use different selectors or parameters
4. If page structure changed, take a new snapshot
5. Report the issue if unable to proceed

## Output Format

When done, provide:
- What was accomplished (1-2 sentences)
- Key findings or results
- Any relevant data extracted

Be concise and focus on results.`;
  }

  /**
   * Get tool descriptions
   */
  private getToolDescriptions(): string[] {
    const tools = this.toolBus.getDefinitions();

    return tools.map((t) => {
      const params = Object.entries((t.parameters?.properties as Record<string, any>) || {})
        .map(([name, info]) => {
          const required = (t.parameters?.required as string[]) || [];
          const req = required.includes(name) ? ' (required)' : 'optional';
          const type = info?.type || 'unknown';
          const desc = info?.description || '';
          return `  - \`${name}\` (${type}, ${req}): ${desc}`;
        })
        .join('\n');

      return `**\`${t.name}\`**: ${t.description}\n${params}`;
    });
  }

  /**
   * Main execution method with retry logic (kimi-code style)
   */
  async run(task: string): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: StepEvent[] = [];
    const actionsTaken: string[] = [];
    let finalResult = '';
    let success = false;
    let iteration = 0;

    try {
      // Load soul/personality
      this.soul = loadSoul();
      this.cancelled = false;

      // Initialize memory if available
      if (this.memory) {
        await this.memory.onTurnStart();
      }

      // Build conversation with task
      this.conversation = [
        { role: 'user', content: task }
      ];

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt();
      const messages = [
        { role: 'system', content: systemPrompt },
        ...this.conversation
      ];

      this.streamEmitter.emitProgress(0, this.maxIterations, 'starting');

      // Create initial checkpoint
      this.createCheckpoint();

      // Main execution loop
      while (iteration < this.maxIterations && !this.cancelled) {
        iteration++;

        // Create checkpoint before each LLM call
        this.createCheckpoint();

        // Check budget
        if (iteration > this.maxIterations * 0.8) {
          // Consider completion if we're close to max iterations
          const response = await this.llmProvider.chat(
            messages,
            this.toolBus.getDefinitions(),
            systemPrompt,
          );

          if (response.text && !response.tool_calls?.length) {
            // No more tool calls, likely done
            finalResult = response.text;
            success = true;
            break;
          }
        }

        this.streamEmitter.emitProgress(iteration, this.maxIterations, 'thinking');

        // Get LLM response with retry logic (kimi-code pattern)
        let response;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            response = await this.llmProvider.chat(
              messages,
              this.toolBus.getDefinitions(),
              systemPrompt,
            );
            break; // Success, exit retry loop
          } catch (error) {
            lastError = error as Error;

            if (!isRetryableError(error)) {
              throw error; // Non-retryable error, throw immediately
            }

            // Retry with exponential backoff
            if (attempt < MAX_RETRIES - 1) {
              const delay = calculateRetryDelay(attempt);
              this.streamEmitter.emitError(`Retrying after ${delay.toFixed(0)}ms: ${lastError.message}`, true);
              await sleep(delay);
            }
          }
        }

        // If all retries failed
        if (!response) {
          throw lastError || new Error('Failed to get LLM response after retries');
        }

        if (!response.text) {
          finalResult = 'No response from LLM';
          break;
        }

        // Add assistant message
        this.conversation.push({ role: 'assistant', content: response.text });

        // Check for completion
        if (response.done) {
          finalResult = response.text;
          success = true;
          break;
        }

        // Execute tool calls
        if (response.tool_calls && response.tool_calls.length > 0) {
          for (const toolCall of response.tool_calls) {
            if (this.cancelled) break;

            const toolName = toolCall.name;
            const toolArgs = toolCall.arguments || {};

            steps.push({
              phase: 'executing',
              action: toolName,
              detail: JSON.stringify(toolArgs),
            });

            this.streamEmitter.emitStepStart('executing', toolName, JSON.stringify(toolArgs));

            // Execute tool with retry logic
            let result;
            let toolError: Error | null = null;

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
              try {
                result = await this.toolBus.execute(toolName, toolArgs);
                if (result.success) break; // Success, exit retry loop
              } catch (error) {
                toolError = error as Error;

                if (!isRetryableError(error)) {
                  break; // Non-retryable error, break immediately
                }

                // Retry with exponential backoff
                if (attempt < MAX_RETRIES - 1) {
                  const delay = calculateRetryDelay(attempt);
                  this.streamEmitter.emitError(`Retrying ${toolName} after ${delay.toFixed(0)}ms`, true);
                  await sleep(delay);
                }
              }
            }

            const toolSuccess = result?.success ?? false;

            actionsTaken.push(`${toolName}: ${toolSuccess ? 'success' : 'failed'}`);

            // Add tool result to conversation
            // Note: Using stringified format for tool responses to maintain tool call id
            this.conversation.push({
              role: 'tool',
              content: JSON.stringify({
                tool_call_id: toolCall.id,
                name: toolName,
                content: toolSuccess
                  ? (result?.output as string) || 'Done'
                  : (result?.error || toolError?.message || 'Failed'),
              }),
            });

            // Error tracking and reflection
            if (!toolSuccess) {
              this.consecutiveErrors++;
              this.lastError = result?.error || toolError?.message || 'Unknown error';
              this.streamEmitter.emitError(this.lastError, true);

              // Reflection: after consecutive errors, add context
              if (this.consecutiveErrors >= 2) {
                this.conversation.push({
                  role: 'system',
                  content: `Note: The last ${this.consecutiveErrors} actions failed. Error: ${this.lastError}. Please try a different approach.`,
                });
                this.consecutiveErrors = 0; // Reset after reflection
              }
            } else {
              this.consecutiveErrors = 0; // Reset on success
            }

            // Check if critical tool failed
            const isCriticalTool = ['browser_navigate', 'browser_click', 'browser_type'].includes(toolName);
            if (isCriticalTool && !toolSuccess) {
              // Critical tool failed, may need to retry
              this.streamEmitter.emitError(`${toolName}: ${result?.error}`, true);

              // Add recovery prompt
              this.conversation.push({
                role: 'system',
                content: `Critical tool ${toolName} failed. The element may not be visible or the page structure may have changed. Consider taking a new snapshot or using alternative selectors.`,
              });
            }
          }
        }

        // Check if task is complete
        if (this.isTaskComplete(response.text)) {
          finalResult = response.text;
          success = true;
          break;
        }
      }

      // Finalize
      // Note: memory cleanup is handled by memory strategy itself
      return {
        task,
        result: finalResult || 'Task completed',
        success,
        steps,
        actions_taken: actionsTaken,
        iterations: iteration,
        strategy_used: 'browser',
        elapsed_secs: Math.round(((Date.now() - startTime) / 1000) * 100) / 100,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        task,
        result: errorMessage,
        success: false,
        steps,
        actions_taken: actionsTaken,
        iterations: iteration,
        strategy_used: 'browser',
        elapsed_secs: Math.round(((Date.now() - startTime) / 1000) * 100) / 100,
      };
    } finally {
      // Clean up checkpoints
      this.checkpoints = [];
      this.nextCheckpointId = 0;
    }
  }

  /**
   * Check if task appears complete
   */
  private isTaskComplete(content: string): boolean {
    const completionIndicators = [
      'task complete', 'done', 'finished', 'accomplished',
      'result:', 'summary:', 'here is', 'the answer is',
      'successfully', 'completed the task',
    ];

    const lowerContent = content.toLowerCase();
    return completionIndicators.some((indicator) => lowerContent.includes(indicator));
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.conversation = [];
    this.cancelled = false;
    this.checkpoints = [];
    this.nextCheckpointId = 0;
    this.consecutiveErrors = 0;
    this.lastError = null;
  }

  /**
   * Get conversation history
   */
  getConversation(): Message[] {
    return [...this.conversation];
  }

  /**
   * Get current state
   */
  getState() {
    return {
      conversation: this.conversation,
      iteration: 0,
      cancelled: this.cancelled,
      toolsInitialized: this.toolsInitialized,
      checkpoints: this.checkpoints,
      consecutiveErrors: this.consecutiveErrors,
    };
  }
}
