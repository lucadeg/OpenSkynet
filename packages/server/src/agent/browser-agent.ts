export class BrowserSubagent {
  private browserSession: any;
  private llmProvider: any;

  constructor(browserSession: any, llmProvider: any) {
    this.browserSession = browserSession;
    this.llmProvider = llmProvider;
  }

  async run(
    task: string,
    onStep?: (action: string, detail: string) => void,
  ): Promise<{ result: string; actions: Array<Record<string, unknown>> }> {
    const actions: Array<Record<string, unknown>> = [];

    try {
      onStep?.("start", `Beginning browser task: ${task}`);

      if (!this.browserSession) {
        return {
          result: "No browser session available",
          actions,
        };
      }

      const systemPrompt = `You are a browser automation agent. Execute the given task by performing browser actions. 
Return a JSON object with "action", "selector" (if applicable), "value" (if applicable), and "reasoning" fields.`;

      const messages = [
        { role: "user", content: task },
      ];

      const response = await this.llmProvider.chat(messages, [], systemPrompt);
      const text = response.text ?? "";

      if (response.tool_calls.length > 0) {
        for (const tc of response.tool_calls) {
          const action: Record<string, unknown> = {
            tool: tc.name,
            arguments: tc.arguments,
          };
          actions.push(action);
          onStep?.(tc.name, JSON.stringify(tc.arguments));
        }
      }

      const resultText = text || (actions.length > 0 ? "Browser actions completed" : "No actions taken");

      onStep?.("done", resultText);

      return { result: resultText, actions };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onStep?.("error", errorMsg);
      return {
        result: `Browser error: ${errorMsg}`,
        actions,
      };
    }
  }
}
