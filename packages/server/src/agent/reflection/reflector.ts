import type { StepEvent, Strategy } from "../../core/types.js";

export interface ReflectionResult {
  success: boolean;
  analysis: string;
  shouldRetry: boolean;
  adjustedStrategy?: Strategy;
}

export class Reflector {
  constructor(private llmProvider: any) {}

  async reflect(
    task: string,
    steps: StepEvent[],
    result: string,
  ): Promise<ReflectionResult> {
    const failed = steps.filter(
      (s) => s.observation?.toLowerCase().includes("error"),
    );

    if (failed.length === 0) {
      return { success: true, analysis: "All steps completed successfully", shouldRetry: false };
    }

    const prompt = [
      `Task: ${task}`,
      `Steps taken: ${steps.length}`,
      `Failed steps: ${failed.length}`,
      `Result: ${result.substring(0, 500)}`,
      `Failed actions: ${failed.map((s) => s.action).join(", ")}`,
      "",
      "Analyze the failures and determine: should we retry? If so, suggest a strategy adjustment.",
      'Respond in JSON: { "analysis": "...", "shouldRetry": bool, "adjustedStrategy": "direct" | "use_skill" | "delegate" | "decompose" | null }',
    ].join("\n");

    const response = await this.llmProvider.chat(
      [{ role: "user", content: prompt }],
      [],
    );

    try {
      const parsed = JSON.parse(response.text ?? "{}");
      return {
        success: !parsed.shouldRetry,
        analysis: parsed.analysis ?? "Analysis unavailable",
        shouldRetry: parsed.shouldRetry ?? false,
        adjustedStrategy: parsed.adjustedStrategy,
      };
    } catch {
      return {
        success: false,
        analysis: "Failed to parse reflection response",
        shouldRetry: false,
      };
    }
  }
}
