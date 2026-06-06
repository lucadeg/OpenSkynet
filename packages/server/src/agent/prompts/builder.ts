export class PromptBuilder {
  buildSystemPrompt(opts: {
    soul?: string;
    memory?: string;
    skills?: string;
    locale?: string;
    task?: string;
  }): string {
    const parts: string[] = [];

    if (opts.soul) parts.push(opts.soul);
    if (opts.locale) parts.push(`Language/Locale: ${opts.locale}`);
    if (opts.memory) parts.push(`\nRelevant memory:\n${opts.memory}`);
    if (opts.skills) parts.push(`\nAvailable skills:\n${opts.skills}`);
    if (opts.task) parts.push(`\nCurrent task: ${opts.task}`);

    return parts.join("\n\n");
  }

  buildToolPrompt(toolResults: Array<{ name: string; result: string }>): string {
    if (!toolResults.length) return "";
    const lines = toolResults.map((r) => `[${r.name}]: ${r.result}`);
    return `Tool results:\n${lines.join("\n")}`;
  }
}
