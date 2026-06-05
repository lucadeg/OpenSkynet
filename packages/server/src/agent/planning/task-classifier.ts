import { SCHEDULE_KEYWORDS, CHAT_KEYWORDS } from "../locales";

export type TaskCategory = "coding" | "browser" | "conversational" | "scheduling";

const CODING_PATTERN =
  /\b(code|coding|program|programming|implement|refactor|debug|fix\s+bug|build|test|compile|git|commit|branch|merge|deploy|function|class|module|package|library|api|server|client|database|query|script)\b/i;
const FILE_EXT_PATTERN =
  /\.(ts|tsx|js|jsx|py|rs|go|java|rb|cpp|c|h|css|html|sql|sh|bash|yaml|yml|json|toml|md|php|swift|kt|scala)\b/i;
const BROWSER_PATTERN =
  /\b(url|website|webpage|browse|navigate|click|fill\s+form|scrape|screenshot|web\s+search|open\s+page|browser)\b|https?:\/\/\S+/i;

export class TaskClassifier {
  classify(task: string): TaskCategory {
    const lower = task.toLowerCase();

    if (this._matchesSchedule(lower)) return "scheduling";
    if (FILE_EXT_PATTERN.test(task) || CODING_PATTERN.test(task)) return "coding";
    if (BROWSER_PATTERN.test(task)) return "browser";
    if (this._matchesChat(lower)) return "conversational";

    return "conversational";
  }

  private _matchesSchedule(lower: string): boolean {
    if (/^(\d+\s+){4,5}\d*/.test(lower.trim())) return true;
    for (const keywords of Object.values(SCHEDULE_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) return true;
      }
    }
    return false;
  }

  private _matchesChat(lower: string): boolean {
    for (const keywords of Object.values(CHAT_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) return true;
      }
    }
    return false;
  }
}
