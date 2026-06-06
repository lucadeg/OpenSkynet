export interface AgentResult {
  task: string;
  success: boolean;
  steps: Array<{ action: string; observation: string }>;
  output: string;
  duration: number;
}

export class PostTaskHandler {
  private skillEngine: any;
  private scheduler: any;
  private memory: any;

  constructor(dependencies: {
    skillEngine?: any;
    scheduler?: any;
    memory?: any;
  }) {
    this.skillEngine = dependencies.skillEngine;
    this.scheduler = dependencies.scheduler;
    this.memory = dependencies.memory;
  }

  async handle(result: AgentResult): Promise<{
    skillCreated?: string;
    scheduledJobId?: string;
  }> {
    const outcome: { skillCreated?: string; scheduledJobId?: string } = {};

    if (this.memory) {
      await this.memory.store("task_history", {
        task: result.task,
        success: result.success,
        steps: result.steps.length,
        duration: result.duration,
        timestamp: Date.now(),
      });
    }

    if (result.success && result.steps.length >= 2 && this.skillEngine) {
      const repeatPatterns = result.steps.filter(
        (s) =>
          s.action.startsWith("navigate") ||
          s.action.startsWith("click") ||
          s.action.startsWith("fill")
      );

      if (repeatPatterns.length >= 2) {
        try {
          await this.skillEngine.register({
            name: `auto_${result.task.slice(0, 30).replace(/\s+/g, "_")}`,
            description: `Auto-learned skill for: ${result.task}`,
            steps: result.steps.map((s) => s.action),
          });
          outcome.skillCreated = result.task.slice(0, 30);
        } catch {
          // skill registration failed
        }
      }
    }

    if (this.scheduler) {
      const isRecurring = /daily|weekly|every|schedule|cron/i.test(result.task);
      if (isRecurring) {
        try {
          const job = await this.scheduler.schedule({
            task: result.task,
            interval: "daily",
          });
          outcome.scheduledJobId = job?.id;
        } catch {
          // scheduling failed
        }
      }
    }

    return outcome;
  }
}
