import type { ToolDefinition } from "../../../core/types.js";
import type { ToolResult } from "../interfaces.js";
import type { ToolBus } from "../bus.js";

export class MediaProvider {
  register(bus: ToolBus): void {
    const definition: ToolDefinition = {
      name: "take_screenshot",
      description: "Take a screenshot of the current screen or browser",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Screenshot target: screen or browser (default screen)" },
        },
        required: [],
      },
      toolset: "media",
    };

    bus.register(definition, async (_name: string, args: Record<string, unknown>) => {
      return {
        success: false,
        output: "",
        error: `Screenshot not yet implemented (target: ${args.target ?? "screen"})`,
      };
    });
  }
}
