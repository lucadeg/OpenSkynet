import { SubagentRegistry } from "../subagents/registry";
import { SubagentFactory } from "../subagents/factory";

export interface AgentResult {
  success: boolean;
  output: string;
  artifacts: Array<{ type: string; name: string; content: string }>;
  durationMs: number;
}

export class SystemOrchestrator {
  private registry: SubagentRegistry;
  private factory: SubagentFactory;

  constructor() {
    this.registry = new SubagentRegistry();
    this.factory = new SubagentFactory(this.registry);
  }

  async run(task: string, llmProvider: any, browserSession: any): Promise<AgentResult> {
    const start = Date.now();

    const mode = this.classify(task);
    const subtasks = this.decompose(task);

    const results: string[] = [];

    for (const subtask of subtasks) {
      const agent = this.factory.create(mode);
      if (!agent) {
        results.push(`[error] no agent for mode "${mode}"`);
        continue;
      }

      try {
        const result = await agent.run(subtask);
        results.push(result);
      } catch (err) {
        results.push(
          `[error] ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      success: true,
      output: results.join("\n"),
      artifacts: [],
      durationMs: Date.now() - start,
    };
  }

  private classify(task: string): string {
    const lower = task.toLowerCase();
    if (/browse|search|website|url|page|scrape/.test(lower)) return "browser";
    if (/code|implement|refactor|debug|fix|build/.test(lower)) return "coding";
    if (/orchestrate|coordinate|multi|parallel|workflow/.test(lower))
      return "orchestrator";
    return "chat";
  }

  private decompose(task: string): string[] {
    const lines = task
      .split(/[.;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length > 1 ? lines : [task];
  }
}
