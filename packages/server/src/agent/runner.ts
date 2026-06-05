import type { AgentResult } from "../core/types";
import type { LLMProvider } from "../llm/provider";
import { TaskClassifier } from "./planning/task-classifier";
import type { TaskCategory } from "./planning/task-classifier";
import { TaskPlanner } from "./planning/task-planner";
import { PromptBuilder } from "./prompts/builder";

const MODE_ENGINES: Record<string, string> = {
  coding: "coding-agent",
  browser: "browser-agent",
  orchestrator: "orchestrator",
};

export class AgentRunner {
  private classifier: TaskClassifier;
  private planner: TaskPlanner;
  private promptBuilder: PromptBuilder;

  constructor(
    private llmProvider: LLMProvider,
    private toolBus?: any,
  ) {
    this.classifier = new TaskClassifier();
    this.planner = new TaskPlanner(llmProvider);
    this.promptBuilder = new PromptBuilder();
  }

  async run(task: string, mode?: string): Promise<AgentResult> {
    const start = Date.now();
    const category: TaskCategory = mode
      ? this._modeToCategory(mode)
      : this.classifier.classify(task);

    const plan = this.planner.planSync(task, category);

    const systemPrompt = this.promptBuilder.buildSystemPrompt({ task });
    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: task },
    ];

    const tools = this.toolBus?.getDefinitions() ?? [];
    const steps: AgentResult["steps"] = [];
    const actions: string[] = [];
    let iterations = 0;
    let finalResult = "";

    while (iterations < 50) {
      iterations++;

      const response = await this.llmProvider.chat(messages, tools, systemPrompt);

      if (response.tool_calls.length === 0) {
        finalResult = response.text ?? "";
        break;
      }

      for (const tc of response.tool_calls) {
        actions.push(tc.name);
        steps.push({
          phase: "executing",
          action: tc.name,
          detail: JSON.stringify(tc.arguments),
        });

        const toolResult = this.toolBus
          ? await this.toolBus.execute(tc.name, tc.arguments)
          : { output: "No tool bus configured", success: false };

        steps[steps.length - 1].observation = toolResult.output;

        messages.push({
          role: "assistant",
          content: null as any,
          tool_calls: [tc],
        } as any);
        messages.push({
          role: "tool",
          content: toolResult.success
            ? toolResult.output
            : `Error: ${toolResult.error ?? "unknown"}`,
          tool_call_id: tc.id,
        } as any);
      }
    }

    return {
      task,
      result: finalResult,
      success: true,
      steps,
      actions_taken: actions,
      iterations,
      strategy_used: plan.strategy,
      elapsed_secs: (Date.now() - start) / 1000,
    };
  }

  private _modeToCategory(mode: string): TaskCategory {
    if (mode === "coding" || MODE_ENGINES[mode] === "coding-agent") return "coding";
    if (mode === "browser" || MODE_ENGINES[mode] === "browser-agent") return "browser";
    if (mode === "orchestrator") return "conversational";
    return this.classifier.classify(mode);
  }
}
