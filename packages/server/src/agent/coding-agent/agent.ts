/**
 * Main Coding Agent - handles code editing tasks with project context.
 */

import type { LLMProvider } from "../../llm/provider";
import type {
  ProjectInfo,
  CodingResult,
  FileEdit,
  HookContext,
  CodingAgentConfig,
} from "./types";
import { discoverProject, getProjectSummary } from "./context";
import { createDefaultPipeline, type HookPipeline } from "./hooks";
import { createCodingToolRegistry } from "./tools";
import { InlineVerifier, verifyEdits } from "./verifier";
import { buildSystemPrompt, buildTaskPrompt } from "./prompts";
import type { ToolBus } from "../tools/interfaces";

const MAX_ROUNDS = 30;
const MAX_CONSECUTIVE_ERRORS = 3;
const VERIFY_AFTER_EDITS = true;

export class CodingAgent {
  private llm: LLMProvider;
  private toolRegistry: ToolBus;
  private maxRounds: number;
  private maxConsecutiveErrors: number;
  private verifyAfterEdits: boolean;
  private project: ProjectInfo;
  private verifier: InlineVerifier;
  private consecutiveErrors: number;
  private editedFiles: string[] = [];
  private hookPipeline: HookPipeline | null;
  private sessionId: string;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private systemPromptOverride: string | undefined;
  private onStep?: (action: string, detail: string) => void;
  private onStreamingText?: (text: string) => void;

  constructor(config: CodingAgentConfig) {
    this.llm = config.llm;
    this.toolRegistry = createCodingToolRegistry(config.llm);
    this.maxRounds = config.maxRounds ?? MAX_ROUNDS;
    this.maxConsecutiveErrors = config.maxConsecutiveErrors ?? MAX_CONSECUTIVE_ERRORS;
    this.verifyAfterEdits = config.verifyAfterEdits ?? VERIFY_AFTER_EDITS;
    this.hookPipeline = config.hooks ?? null;
    this.consecutiveErrors = 0;
    this.systemPromptOverride = config.systemPromptOverride;
    this.onStep = config.onStep;
    this.onStreamingText = config.onStreamingText;

    // Initialize project
    if (config.projectInfo) {
      this.project = config.projectInfo;
    } else if (config.autoDiscoverProject !== false) {
      // Auto-discover project (simplified)
      this.project = { name: "unknown", root: process.cwd() };
    } else {
      this.project = {};
    }

    this.verifier = new InlineVerifier();
    this.sessionId = Math.random().toString(36).slice(2, 10);
    this.conversationHistory = config.conversationHistory?.slice() ?? [];
  }

  /**
   * Execute a coding task.
   */
  async execute(task: string, files?: string[]): Promise<CodingResult> {
    this.consecutiveErrors = 0;
    this.editedFiles = [];

    const result: CodingResult = {
      success: false,
      edits: [],
      errors: [],
    };

    try {
      // Execute pre-hooks
      const hookContext: HookContext = {
        project: this.project,
        task,
        files: files ?? [],
        edits: [],
        metadata: { sessionId: this.sessionId },
      };

      if (this.hookPipeline) {
        const preHookResult = await this.hookPipeline.executePreHooks(hookContext);
        if (!preHookResult.continue) {
          result.errors.push("Pre-hooks prevented execution");
          return result;
        }

        if (preHookResult.modifications) {
          if (preHookResult.modifications.task) {
            task = preHookResult.modifications.task;
          }
          if (preHookResult.modifications.files) {
            files = preHookResult.modifications.files;
          }
        }
      }

      // Build system prompt
      const systemPrompt = buildSystemPrompt({
        project: this.project,
        task,
        files,
        conversationHistory: this.conversationHistory,
        systemPromptOverride: this.systemPromptOverride,
        enableVerification: this.verifyAfterEdits,
      });

      // Main execution loop
      let round = 0;
      while (round < this.maxRounds && this.consecutiveErrors < this.maxConsecutiveErrors) {
        round++;

        this._emitStep("round_start", `Round ${round}/${this.maxRounds}`);

        // Get LLM response
        const response = await this.llm.chat(
          [
            { role: "system", content: systemPrompt },
            ...this.conversationHistory,
            { role: "user", content: buildTaskPrompt(task) },
          ],
          this._getToolDefinitions(),
        );

        // Process response
        if (response.text) {
          this.conversationHistory.push({ role: "assistant", content: response.text });
          this.onStreamingText?.(response.text);
        }

        // Handle tool calls
        if (response.tool_calls && response.tool_calls.length > 0) {
          const edits = await this._processToolCalls(response.tool_calls);

          if (edits.length > 0) {
            result.edits.push(...edits);
            this.editedFiles.push(...edits.map((e) => e.path));

            // Verify edits if enabled
            if (this.verifyAfterEdits) {
              const verificationResults = await verifyEdits(edits);
              result.verificationResults = verificationResults;

              const failed = verificationResults.filter((r) => !r.passed);
              if (failed.length > 0) {
                result.errors.push(...failed.map((f) => `${f.filePath}: ${f.errors.join(", ")}`));
              }
            }

            result.success = true;
            break; // Task completed
          }
        }

        // Check if task is complete
        if (response.done) {
          result.success = true;
          break;
        }

        // Check for errors in response
        if (!response.text && !response.tool_calls) {
          this.consecutiveErrors++;
          result.errors.push("No response from LLM");
          continue;
        }

        this.consecutiveErrors = 0;
      }

      // Execute post-hooks
      if (this.hookPipeline) {
        hookContext.edits = result.edits;
        const postHookResult = await this.hookPipeline.executePostHooks(hookContext, result);

        if (postHookResult.status === "failure") {
          result.success = false;
          result.errors.push(postHookResult.message ?? "Post-hooks failed");
        }

        if (postHookResult.additionalEdits) {
          result.edits.push(...postHookResult.additionalEdits);
        }
      }

      result.summary = this._generateSummary(result, round);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    return result;
  }

  private async _processToolCalls(toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>): Promise<FileEdit[]> {
    const edits: FileEdit[] = [];

    for (const toolCall of toolCalls) {
      const { name, arguments: args } = toolCall;

      try {
        switch (name) {
          case "write_file":
          case "edit_file":
            const path = args.path as string;
            const content = args.content as string;
            // In a full implementation, this would actually write to files
            edits.push({
              path,
              originalContent: "",
              newContent: content,
              edits: [{
                type: "replace",
                startLine: args.startLine as number ?? 1,
                endLine: args.endLine as number ?? 1,
                content,
                description: `Edit ${path}`,
              }],
            });
            break;

          case "read_file":
            // Would read file content
            break;

          default:
            // Handle other tools
            break;
        }
      } catch (err) {
        this.consecutiveErrors++;
        console.error(`Tool ${name} failed:`, err);
      }
    }

    return edits;
  }

  private _getToolDefinitions() {
    // Return tool definitions for the LLM
    return [
      {
        type: "function" as const,
        function: {
          name: "write_file",
          description: "Write content to a file",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path" },
              content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "edit_file",
          description: "Edit specific lines in a file",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path" },
              startLine: { type: "number", description: "Starting line" },
              endLine: { type: "number", description: "Ending line" },
              content: { type: "string", description: "New content" },
            },
            required: ["path", "startLine", "endLine", "content"],
          },
        },
      },
    ];
  }

  private _emitStep(action: string, detail: string): void {
    if (this.onStep) {
      try {
        this.onStep(action, detail);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private _generateSummary(result: CodingResult, rounds: number): string {
    const parts: string[] = [];

    parts.push(`Session: ${this.sessionId}`);
    parts.push(`Rounds: ${rounds}`);

    if (result.edits.length > 0) {
      parts.push(`Files edited: ${result.edits.length}`);
      parts.push(`Modified files: ${[...new Set(result.edits.map((e) => e.path))].join(", ")}`);
    }

    if (result.errors.length > 0) {
      parts.push(`Errors: ${result.errors.length}`);
    }

    return parts.join("\n");
  }

  /**
   * Update the project info.
   */
  setProjectInfo(project: ProjectInfo): void {
    this.project = project;
  }

  /**
   * Update conversation history.
   */
  setConversationHistory(history: Array<{ role: string; content: string }>): void {
    this.conversationHistory = history;
  }

  /**
   * Add a message to conversation history.
   */
  addToHistory(role: string, content: string): void {
    this.conversationHistory.push({ role, content });
  }

  /**
   * Clear conversation history.
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get current project info.
   */
  getProjectInfo(): ProjectInfo {
    return this.project;
  }

  /**
   * Get list of edited files in current session.
   */
  getEditedFiles(): string[] {
    return [...this.editedFiles];
  }
}

export async function createCodingAgent(config: CodingAgentConfig): Promise<CodingAgent> {
  return new CodingAgent(config);
}
