import type { ToolDefinition, LLMResponse } from "../../core/types.js";

const DEFAULT_MAX_ITERATIONS = 50;

export class ToolLoopExecutor {
  constructor(
    private llmProvider: any,
    private toolBus: any,
  ) {}

  async execute(
    task: string,
    tools: ToolDefinition[],
    maxIterations: number = DEFAULT_MAX_ITERATIONS,
  ): Promise<{ response: LLMResponse; iterations: number }> {
    const messages: Array<Record<string, any>> = [
      { role: "user", content: task },
    ];

    let iterations = 0;
    let response: LLMResponse;

    while (iterations < maxIterations) {
      iterations++;
      response = await this.llmProvider.chat(messages, tools);

      if (response.tool_calls.length === 0) {
        return { response, iterations };
      }

      messages.push({
        role: "assistant",
        content: response.text,
        tool_calls: response.tool_calls,
      });

      for (const tc of response.tool_calls) {
        const result = await this.toolBus.execute(tc.name, tc.arguments);
        messages.push({
          role: "tool",
          content: result.success ? result.output : `Error: ${result.error ?? "unknown"}`,
          tool_call_id: tc.id,
        });
      }
    }

    return { response: response!, iterations };
  }
}
