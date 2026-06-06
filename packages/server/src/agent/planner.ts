const CRON_PATTERN_EN =
  /\b(every\s+(day|morning|evening|hour|minute|week|month)|daily|weekly|hourly|monthly|at\s+\d{1,2}(:\d{2})?\s*(am|pm)?)\b/i;
const CRON_PATTERN_CJK =
  /(每天|每日|每周|每月|每小时|定[时期]|重复|毎日|毎週|毎月|毎時|매일|매주|매월|매시간)/;
const CRON_EXPR_PATTERN =
  /^([\d*/,\-]+\s+){4}[\d*/,\-]+/;

export class TaskPlannerRegex {
  detectCron(task: string): { isCron: boolean; cronExpr?: string; actualTask?: string } {
    const trimmed = task.trim();

    if (CRON_EXPR_PATTERN.test(trimmed)) {
      const parts = trimmed.split(/\s+/);
      const cronExpr = parts.slice(0, 5).join(" ");
      const actualTask = parts.slice(5).join(" ");
      return { isCron: true, cronExpr, actualTask };
    }

    const enMatch = task.match(CRON_PATTERN_EN);
    const cjkMatch = task.match(CRON_PATTERN_CJK);

    if (enMatch || cjkMatch) {
      const schedulePart = enMatch?.[0] ?? cjkMatch?.[0] ?? "";
      const actualTask = task.replace(schedulePart, "").trim();
      const cronExpr = this._keywordToCron(task);
      return { isCron: true, cronExpr, actualTask: actualTask || task };
    }

    return { isCron: false };
  }

  detectUrl(task: string): { isUrl: boolean; url?: string } {
    const match = task.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/);
    if (match) return { isUrl: true, url: match[0] };
    return { isUrl: false };
  }

  isSimpleTask(task: string): boolean {
    const wordCount = task.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 5) return true;

    const complexMarkers =
      /\b(and\s+then|after\s+that|also\s+|multiple\s+|several\s+|first\s+.+\s+then|before\s+.+\s+after)\b/i;
    if (complexMarkers.test(task)) return false;

    const sentences = task.split(/[.!?\n]/).filter(Boolean).length;
    return sentences <= 1;
  }

  private _keywordToCron(task: string): string {
    const lower = task.toLowerCase();

    if (/\bevery\s+minute\b/i.test(lower) || /每小时|毎時|매시간/.test(task)) {
      return "* * * * *";
    }
    if (/\bevery\s+hour\b|\bhourly\b/i.test(lower)) {
      return "0 * * * *";
    }
    if (/\bevery\s+evening\b/i.test(lower)) {
      return "0 18 * * *";
    }
    if (/\bevery\s+day\b|\bdaily\b|\bevery\s+morning\b/i.test(lower) || /每天|每日|毎日|매일/.test(task)) {
      return "0 9 * * *";
    }
    if (/\bweekly\b|\bevery\s+week\b/i.test(lower) || /每周|毎週|매주/.test(task)) {
      return "0 9 * * 1";
    }
    if (/\bmonthly\b|\bevery\s+month\b/i.test(lower) || /每月|毎月|매월/.test(task)) {
      return "0 9 1 * *";
    }

    return "0 9 * * *";
  }
}
