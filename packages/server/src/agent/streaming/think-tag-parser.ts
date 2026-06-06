type ThinkParams = {
  thinking: string;
  content: string;
};

export class ThinkTagParser {
  parse(text: string): ThinkParams {
    const thinkMatch = text.match(ThinkTagParser.THINK_RE_EXTRACT);
    const thinking = thinkMatch ? thinkMatch[1].trim() : "";
    const content = this.stripThinkTags(text);
    return { thinking, content };
  }

  stripThinkTags(text: string): string {
    return text.replace(ThinkTagParser.THINK_RE, "").trim();
  }

  static THINK_RE = /<think(?:[^>]*>)?\s*([\s\S]*?)<\/think>?/gi;
  static THINK_RE_EXTRACT = /<think(?:[^>]*>)?\s*([\s\S]*?)<\/think>?/i;
}
