/**
 * Electron Agent - Specialized for browser automation and computer control
 *
 * This agent is designed specifically for the Electron app and focuses on:
 * - Browser automation (using Openbrowser)
 * - Computer control (file operations, PPT/PDF manipulation)
 * - Multi-modal content handling
 */

import type { AgentResult, StepEvent, ToolDefinition } from "../../core/types";
import type { LLMProvider } from "../../llm/provider";
import type { BaseMemoryStrategy } from "../memory/strategy";
import type { SkillEngine } from "../skills/engine";
import { ToolBus } from "../agent/tools/bus";
import { AgentInterruptedError, InterruptSignal } from "../agent/interrupt";
import { ContextCompressor } from "../agent/compressor";
import { ProgressTracker } from "../agent/progress";
import { AuditLog, SharedScratchpad, checkBudget, type Budget } from "../agent/guardrails";
import { loadSoul } from "../agent/soul";
import logger from "../core/logging";
import { getConfig } from "../core/config";

type Message = { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };

export interface ElectronAgentOpts {
  llmProvider: LLMProvider;
  memory?: BaseMemoryStrategy;
  skillEngine?: SkillEngine;
  toolBus?: ToolBus;
  headless?: boolean;
}

type ElectronTaskCategory =
  | "browser_control"    // Navigate, click, screenshot, extract text
  | "document_process"  // PPT, PDF manipulation
  | "file_operations"   // Read, write, edit files
  | "web_automation"    // Form filling, scraping
  | "multimodal"        // Image/video processing
  | "general";          // Fallback for general tasks

interface ElectronTaskPlan {
  category: ElectronTaskCategory;
  steps: Array<{ description: string; tools: string[] }>;
}

export class ElectronAgent {
  private llmProvider: LLMProvider;
  private memory: BaseMemoryStrategy | null;
  private skillEngine: SkillEngine | null;
  private toolBus: ToolBus;
  private conversation: Message[];
  private interrupt: InterruptSignal;
  private auditLog: AuditLog;
  private scratchpad: SharedScratchpad;
  private progress: ProgressTracker;
  private compressor: ContextCompressor;
  private maxIterations: number;
  private budget: Budget;
  private soul: string;

  constructor(opts: ElectronAgentOpts) {
    const config = getConfig();
    this.llmProvider = opts.llmProvider;
    this.memory = opts.memory ?? null;
    this.skillEngine = opts.skillEngine ?? null;
    this.toolBus = opts.toolBus ?? new ToolBus();
    this.conversation = [];
    this.interrupt = new InterruptSignal();
    this.auditLog = new AuditLog();
    this.scratchpad = new SharedScratchpad();
    this.progress = new ProgressTracker();
    this.compressor = new ContextCompressor();
    this.soul = "";
    this.maxIterations = config.compressThreshold * 2 + 10;
    this.budget = {
      maxTokens: 200_000,
      maxIterations: this.maxIterations,
      maxTimeMs: 600_000,
      usedTokens: 0,
      usedIterations: 0,
      usedTimeMs: 0,
    };
  }

  async run(task: string): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: StepEvent[] = [];
    const actionsTaken: string[] = [];
    let finalResult = "";
    let success = false;

    try {
      this.soul = loadSoul();
      this.interrupt.reset();
      this.progress = new ProgressTracker();

      if (this.memory) {
        await this.memory.onTurnStart();
      }

      this.interrupt.check();

      // Classify the task for Electron-specific handling
      const plan = this.classifyElectronTask(task);

      this.addUserMessage(task);

      let iteration = 0;
      let done = false;

      while (iteration < this.maxIterations && !done) {
        iteration++;
        this.interrupt.check();

        const budgetCheck = checkBudget(this.budget);
        if (budgetCheck.exceeded) {
          finalResult = `Stopped: ${budgetCheck.reason}`;
          break;
        }

        const systemPrompt = this.buildElectronSystemPrompt(task, plan, iteration);
        const messages = this.compressor.compress(this.conversation as Message[], 100_000);
        const tools = this.toolBus.getDefinitions();

        let response;
        try {
          response = await this.llmProvider.chat(
            messages as Message[],
            tools,
            systemPrompt
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error({ err: errorMsg, iteration }, "electron_agent_llm_failed");
          steps.push({
            phase: "executing",
            action: "llm_error",
            detail: errorMsg
          });
          finalResult = `LLM error: ${errorMsg}`;
          break;
        }

        if (response.tool_calls.length > 0) {
          for (const tc of response.tool_calls) {
            this.interrupt.check();

            const step: StepEvent = {
              phase: "executing",
              action: tc.name,
              detail: JSON.stringify(tc.arguments),
            };
            steps.push(step);
            actionsTaken.push(tc.name);

            this.auditLog.add(tc.name, JSON.stringify(tc.arguments), {
              level: "low",
              reasons: []
            });

            try {
              const result = await this.toolBus.execute(tc.name, tc.arguments);
              step.observation = result.success ? result.output : result.error;
              this.addToolResult(tc.id, tc.name,
                result.success ? result.output : result.error ?? "Tool failed"
              );
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              step.observation = errMsg;
              this.addToolResult(tc.id, tc.name, `Error: ${errMsg}`);
            }
          }

          if (response.text) {
            this.addAssistantMessage(response.text);
          }
        } else {
          const text = response.text ?? "";
          finalResult = text;
          done = true;

          this.addAssistantMessage(text);

          steps.push({
            phase: "done",
            action: "response",
            detail: finalResult,
          });
        }

        this.budget.usedIterations = iteration;
        this.budget.usedTimeMs = Date.now() - startTime;

        // Compress if needed
        if (iteration % 20 === 0 && this.conversation.length > 20) {
          this.conversation = this.compressor.compress(this.conversation as Message[], 80_000);
        }

        if (!done && iteration < this.maxIterations) {
          const reflection = this.reflect(task, steps, iteration);
          if (!reflection.success && reflection.recoveryHint) {
            this.addSystemMessage(`Self-correction: ${reflection.recoveryHint}`);
          }
        }
      }

      if (!done && !finalResult) {
        finalResult = "Max iterations reached without completion.";
      }

      success = finalResult.length > 0 &&
                !finalResult.startsWith("Stopped:") &&
                !finalResult.startsWith("LLM error:");

      await this.runPostTask(task, finalResult, success, plan.category);

    } catch (err) {
      if (err instanceof AgentInterruptedError) {
        finalResult = `Interrupted: ${err.message}`;
        success = false;
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error({ err: errorMsg }, "electron_agent_loop_error");
        finalResult = `Error: ${errorMsg}`;
        success = false;
      }
    }

    const elapsedSecs = (Date.now() - startTime) / 1000;

    return {
      task,
      result: finalResult,
      success,
      steps,
      actions_taken: actionsTaken,
      iterations: this.budget.usedIterations || 1,
      strategy_used: plan.category,
      elapsed_secs: Math.round(elapsedSecs * 100) / 100,
    };
  }

  cancel(): void {
    this.interrupt.trigger("User cancelled");
  }

  getConversation(): Message[] {
    return [...this.conversation];
  }

  private classifyElectronTask(task: string): ElectronTaskPlan {
    const lower = task.toLowerCase();

    // Browser control tasks
    if (/navigate|click|screenshot|scroll|extract.*text|browser|page/.test(lower)) {
      return {
        category: "browser_control",
        steps: [
          { description: "Launch browser instance", tools: ["browser_new"] },
          { description: "Navigate to target URL", tools: ["browser_navigate"] },
          { description: "Perform browser actions", tools: ["browser_click", "browser_scroll"] },
          { description: "Extract content/results", tools: ["browser_screenshot", "browser_extract_text"] },
        ],
      };
    }

    // Document processing tasks (PPT, PDF)
    if (/ppt|powerpoint|pdf|document|slide|presentation/.test(lower)) {
      return {
        category: "document_process",
        steps: [
          { description: "Read document structure", tools: ["file_read", "file_list"] },
          { description: "Extract content and metadata", tools: ["file_read"] },
          { description: "Process or modify document", tools: ["file_write"] },
        ],
      };
    }

    // Web automation tasks
    if (/form|submit|fill|scrape|extract.*data|login/.test(lower)) {
      return {
        category: "web_automation",
        steps: [
          { description: "Navigate to target page", tools: ["browser_navigate"] },
          { description: "Locate form elements", tools: ["browser_extract_text"] },
          { description: "Fill and submit forms", tools: ["browser_click", "browser_fill"] },
          { description: "Verify and capture results", tools: ["browser_screenshot"] },
        ],
      };
    }

    // File operations
    if (/read|write|edit|save|file|folder|directory/.test(lower)) {
      return {
        category: "file_operations",
        steps: [
          { description: "Locate target files", tools: ["file_list", "file_search"] },
          { description: "Read file contents", tools: ["file_read"] },
          { description: "Perform modifications", tools: ["file_write", "file_edit"] },
        ],
      };
    }

    // Default to general purpose
    return {
      category: "general",
      steps: [
        { description: "Analyze task requirements", tools: [] },
        { description: "Execute task", tools: [] },
        { description: "Verify results", tools: [] },
      ],
    };
  }

  private buildElectronSystemPrompt(
    task: string,
    plan: ElectronTaskPlan,
    iteration: number
  ): string {
    const parts: string[] = [];

    if (this.soul) {
      parts.push(this.soul);
    }

    parts.push(`\nElectron Agent Mode: ${plan.category}`);
    parts.push(`Current iteration: ${iteration}/${this.maxIterations}`);

    const planSummary = plan.steps.map((s, i) =>
      `${i + 1}. ${s.description} (tools: ${s.tools.join(", ")})`
    ).join("\n");
    parts.push(`Execution plan:\n${planSummary}`);

    if (this.memory) {
      const memoryContext = this.memory.context(task);
      if (memoryContext) {
        parts.push(`\nRelevant memories:\n${memoryContext}`);
      }
    }

    if (this.skillEngine) {
      const skillSummaries = this.skillEngine.getSkillSummaries();
      if (skillSummaries && skillSummaries !== "No skills available.") {
        parts.push(`\nAvailable skills:\n${skillSummaries}`);
      }
    }

    const progressInfo = this.progress.getProgress();
    if (progressInfo.total > 0) {
      parts.push(
        `Progress: ${progressInfo.completed}/${progressInfo.total} ` +
        `milestones (${progressInfo.percentage}%)`
      );
    }

    // Electron-specific guidance
    parts.push("\nElectron Agent Capabilities:");
    parts.push("- Browser automation: navigate, click, screenshot, extract text");
    parts.push("- Document processing: PPT, PDF, Office files");
    parts.push("- File operations: read, write, edit files and folders");
    parts.push("- Web automation: form filling, data extraction");
    parts.push("- Multi-modal: process images and videos");

    return parts.join("\n");
  }

  private reflect(task: string, steps: StepEvent[], iteration: number): {
    success: boolean;
    recoveryHint?: string
  } {
    const recentSteps = steps.slice(-3);
    const failedSteps = recentSteps.filter((s) =>
      s.observation && s.observation.includes("Error")
    );

    if (failedSteps.length >= 2) {
      return {
        success: false,
        recoveryHint: `Multiple errors detected. Consider trying alternative tools or approach.`,
      };
    }

    const lastStep = recentSteps[recentSteps.length - 1];
    if (lastStep?.observation?.includes("not found") ||
        lastStep?.observation?.includes("failed")) {
      return {
        success: false,
        recoveryHint: `Last action failed: ${lastStep.observation}. Try alternative method.`,
      };
    }

    return { success: true };
  }

  private async runPostTask(
    task: string,
    result: string,
    success: boolean,
    category: ElectronTaskCategory
  ): Promise<void> {
    try {
      if (this.memory && success) {
        this.memory.write("memory", `Task: ${task}\nResult: ${result.slice(0, 500)}`, {
          category,
          success
        });
      }

      if (this.memory) {
        await this.memory.onSessionEnd();
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "electron_agent_post_task_error");
    }
  }

  private addUserMessage(content: string): void {
    this.conversation.push({ role: "user", content });
  }

  private addAssistantMessage(content: string): void {
    this.conversation.push({ role: "assistant", content });
  }

  private addSystemMessage(content: string): void {
    this.conversation.push({ role: "system", content });
  }

  private addToolResult(toolCallId: string, toolName: string, content: string): void {
    this.conversation.push({
      role: "tool",
      content: JSON.stringify({ tool_call_id: toolCallId, name: toolName, content }),
    } as any);
  }
}
