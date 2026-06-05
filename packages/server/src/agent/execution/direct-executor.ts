import type { AgentResult, StepEvent } from "../../core/types.js";

const DEFAULT_MAX_ITERATIONS = 50;

export class DirectExecutor {
  constructor(
    private llmProvider: any,
    private toolBus: any,
  ) {}

  async execute(task: string, systemPrompt?: string): Promise<AgentResult> {
    const start = Date.now();
    const steps: StepEvent[] = [];
    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: task },
    ];
    let iterations = 0;
    let finalResult = "";

    while (iterations < DEFAULT_MAX_ITERATIONS) {
      iterations++;
      const response = await this.llmProvider.chat(
        messages,
        this.toolBus.getDefinitions(),
        systemPrompt,
      );

      if (response.tool_calls.length === 0) {
        finalResult = response.text ?? "";
        break;
      }

      for (const tc of response.tool_calls) {
        const step: StepEvent = {
          phase: "executing",
          action: tc.name,
          detail: JSON.stringify(tc.arguments),
        };

        const toolResult = await this.toolBus.execute(tc.name, tc.arguments);
        step.observation = toolResult.output;
        steps.push(step);

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
      actions_taken: steps.map((s) => s.action),
      iterations,
      strategy_used: "direct",
      elapsed_secs: (Date.now() - start) / 1000,
    };
  }
}
