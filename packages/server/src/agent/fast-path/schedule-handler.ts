import type { AgentResult, StepEvent } from "../../core/types.js";

const SCHEDULE_PATTERNS: Array<{
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => { cron: string; task: string };
}> = [
  {
    pattern: /(?:every|each)\s+day\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    extract: (m) => {
      const time = m[1].trim();
      const parts = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!parts) return { cron: "0 9 * * *", task: "" };
      let hour = parseInt(parts[1], 10);
      const min = parts[2] ? parseInt(parts[2], 10) : 0;
      const ampm = parts[3]?.toLowerCase();
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      return { cron: `${min} ${hour} * * *`, task: "" };
    },
  },
  {
    pattern: /(?:every|each)\s+(?:hour|hourly)/i,
    extract: () => ({ cron: "0 * * * *", task: "" }),
  },
  {
    pattern: /(?:every|each)\s+(\d+)\s+minutes?/i,
    extract: (m) => ({ cron: `*/${m[1]} * * * *`, task: "" }),
  },
];

export class ScheduleHandler {
  detectSchedule(task: string): { cron: string; task: string } | null {
    for (const { pattern, extract } of SCHEDULE_PATTERNS) {
      const match = task.match(pattern);
      if (match) {
        const result = extract(match);
        const taskText = task.replace(pattern, "").trim();
        return { cron: result.cron, task: taskText || task };
      }
    }
    return null;
  }

  async handle(
    cronExpr: string,
    task: string,
    cronManager: any,
  ): Promise<AgentResult | null> {
    const start = Date.now();
    const jobId = await cronManager.register(cronExpr, task);

    return {
      task,
      result: `Scheduled job ${jobId}: "${task}" with cron "${cronExpr}"`,
      success: true,
      steps: [
        {
          phase: "executing",
          action: "schedule",
          detail: `cron: ${cronExpr}`,
        },
      ],
      actions_taken: ["schedule"],
      iterations: 1,
      strategy_used: "direct",
      scheduled_job_id: jobId,
      schedule_cron: cronExpr,
      elapsed_secs: (Date.now() - start) / 1000,
    };
  }
}
