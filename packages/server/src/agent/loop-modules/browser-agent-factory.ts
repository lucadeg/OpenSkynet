export class BrowserAgentFactory {
  createBrowserAgent(browserSession: any, llmProvider: any): any {
    return {
      browser: browserSession,
      llm: llmProvider,

      async navigate(url: string): Promise<any> {
        return this.browser.navigate(url);
      },

      async click(selector: string): Promise<any> {
        return this.browser.click(selector);
      },

      async type(selector: string, text: string): Promise<any> {
        return this.browser.type(selector, text);
      },

      async extractContent(): Promise<string> {
        return this.browser.getContent();
      },

      async screenshot(): Promise<string> {
        return this.browser.screenshot();
      },
    };
  }
}
