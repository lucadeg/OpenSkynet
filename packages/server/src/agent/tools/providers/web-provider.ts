import type { ToolDefinition } from "../../../core/types.js";
import type { ToolResult } from "../interfaces.js";
import type { ToolBus } from "../bus.js";

export class WebProvider {
  register(bus: ToolBus): void {
    const fetchDef: ToolDefinition = {
      name: "fetch_url",
      description: "Fetch content from a URL",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch" },
          method: { type: "string", description: "HTTP method (default GET)" },
          headers: { type: "object", description: "Request headers" },
          body: { type: "string", description: "Request body" },
        },
        required: ["url"],
      },
      toolset: "web",
    };

    bus.register(fetchDef, async (_name: string, args: Record<string, unknown>) => {
      try {
        const resp = await fetch(args.url as string, {
          method: (args.method as string) || "GET",
          headers: args.headers as Record<string, string> | undefined,
          body: args.body as string | undefined,
        });
        const text = await resp.text();
        return { success: resp.ok, output: text.slice(0, 50_000), error: resp.ok ? undefined : `HTTP ${resp.status}` };
      } catch (err: unknown) {
        return { success: false, output: "", error: (err as Error).message };
      }
    });

    const searchDef: ToolDefinition = {
      name: "search_web",
      description: "Search the web for a query",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          max_results: { type: "number", description: "Max results (default 5)" },
        },
        required: ["query"],
      },
      toolset: "web",
    };

    bus.register(searchDef, async () => {
      return { success: false, output: "", error: "Web search is not yet implemented" };
    });
  }
}
