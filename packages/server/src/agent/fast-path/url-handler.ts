import type { AgentResult, StepEvent } from "../../core/types.js";

const URL_PATTERN = /^https?:\/\/\S+$/i;

export class UrlHandler {
  extractUrl(task: string): string | null {
    const trimmed = task.trim();
    if (URL_PATTERN.test(trimmed)) return trimmed;
    const match = trimmed.match(/(https?:\/\/\S+)/i);
    return match ? match[1] : null;
  }

  async handle(url: string, browserSession: any): Promise<AgentResult | null> {
    const start = Date.now();
    const steps: StepEvent[] = [];

    const navStep: StepEvent = {
      phase: "executing",
      action: "navigate",
      detail: url,
      url,
    };
    steps.push(navStep);

    await browserSession.navigate(url);

    const content = await browserSession.getContent();
    const title = await browserSession.getTitle();

    steps.push({
      phase: "observing",
      action: "extract_content",
      detail: title,
      url,
    });

    return {
      task: url,
      result: content ?? "",
      success: true,
      steps,
      actions_taken: ["navigate", "extract_content"],
      iterations: 1,
      strategy_used: "direct",
      elapsed_secs: (Date.now() - start) / 1000,
    };
  }
}
