import type { AgentResult } from "../../core/types.js";

export class DelegateExecutor {
  async delegate(
    subtasks: Array<{ task: string; strategy: string }>,
  ): Promise<AgentResult[]> {
    const results = await Promise.all(
      subtasks.map((subtask) =>
        Promise.resolve({
          task: subtask.task,
          result: "",
          success: false,
          steps: [],
          actions_taken: [],
          iterations: 0,
          strategy_used: subtask.strategy,
          elapsed_secs: 0,
        } satisfies AgentResult),
      ),
    );
    return results;
  }
}
