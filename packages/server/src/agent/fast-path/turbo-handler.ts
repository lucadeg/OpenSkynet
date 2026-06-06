import type { AgentResult, StepEvent } from "../../core/types.js";

const ACTION_KEYWORDS = /\b(browser|navigate|click|type|file|code|screenshot|scroll|download|upload|execute|terminal|shell)\b/i;
const MAX_TASK_LENGTH = 50;

export class TurboHandler {
  isEligible(task: string): boolean {
    return task.length < MAX_TASK_LENGTH && !ACTION_KEYWORDS.test(task);
  }

  async handle(task: string, llmProvider: any): Promise<AgentResult | null> {
    if (!this.isEligible(task)) return null;

    const start = Date.now();
    const response = await llmProvider.chat(
      [{ role: "user", content: task }],
      [],
    );

    return {
      task,
      result: response.text ?? "",
      success: true,
      steps: [
        {
          phase: "executing",
          action: "direct_response",
          detail: task,
        } satisfies StepEvent,
      ],
      actions_taken: ["direct_response"],
      iterations: 1,
      strategy_used: "direct",
      elapsed_secs: (Date.now() - start) / 1000,
    };
  }
}
