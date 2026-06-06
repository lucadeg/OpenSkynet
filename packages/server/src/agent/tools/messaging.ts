/**
 * Messaging tool - send messages to configured integrations (Discord, Telegram, etc.)
 */

import type { ToolDefinition } from "../../core/types.js";
import type { ToolResult } from "./interfaces.js";
import type { ToolBus } from "./bus.js";

export interface MessagingConfig {
  integrations?: Map<string, MessagingIntegration>;
}

export interface MessagingIntegration {
  send(channel: string, content: string): Promise<string>;
}

export class MessagingTool {
  private integrations: Map<string, MessagingIntegration>;

  constructor(config: MessagingConfig = {}) {
    this.integrations = config.integrations ?? new Map();
  }

  register(bus: ToolBus): void {
    const definition: ToolDefinition = {
      name: "send_message",
      description: "Send messages to configured messaging platforms (Discord, Telegram, etc.)",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list", "send"],
            description: "Action to perform: 'list' to see available targets, 'send' to send a message",
          },
          target: {
            type: "string",
            description:
              "Target in format 'platform:channel_key' (e.g., 'discord:alerts', 'telegram:admin'). Use action='list' to see available targets.",
          },
          content: {
            type: "string",
            description: "Message content to send",
          },
        },
        required: ["action"],
      },
      toolset: "messaging",
    };

    bus.register(definition, async (_name: string, args: Record<string, unknown>) => {
      const action = args.action as string;

      if (action === "list") {
        return this._listTargets();
      }

      if (action === "send") {
        return this._sendMessage(args);
      }

      return {
        success: false,
        output: "",
        error: `Unknown action: ${action}. Use 'list' or 'send'.`,
      };
    });
  }

  private async _listTargets(): Promise<ToolResult> {
    if (this.integrations.size === 0) {
      return {
        success: true,
        output:
          "No messaging targets configured. Use integration configuration to set up Discord, Telegram, or other platforms.",
      };
    }

    const targets: string[] = [];
    for (const [name, integration] of this.integrations) {
      // Try to get channels from the integration
      if ("getChannels" in integration && typeof integration.getChannels === "function") {
        const channels = (integration as any).getChannels();
        for (const [key, label] of Object.entries(channels as Record<string, string>)) {
          targets.push(`${name}:${key} (${label})`);
        }
      } else {
        targets.push(name);
      }
    }

    if (targets.length === 0) {
      return {
        success: true,
        output: "No messaging channels configured. Add channels to your integrations.",
      };
    }

    return {
      success: true,
      output: "Available messaging targets:\n" + targets.map((t) => `  ${t}`).join("\n"),
    };
  }

  private async _sendMessage(args: Record<string, unknown>): Promise<ToolResult> {
    const target = args.target as string;
    const content = args.content as string;

    if (!target || !content) {
      return {
        success: false,
        output: "",
        error: "target and content are required for send action. Use action='list' to see available targets.",
      };
    }

    if (!target.includes(":")) {
      return {
        success: false,
        output: "",
        error:
          "Target format: 'platform:channel_key' (e.g., 'discord:alerts', 'telegram:admin'). Use action='list' to see available targets.",
      };
    }

    const [platform, channelKey] = target.split(":", 2);
    const integration = this.integrations.get(platform);

    if (!integration) {
      return {
        success: false,
        output: "",
        error: `Integration '${platform}' not found or not enabled. Configure it first.`,
      };
    }

    try {
      const result = await integration.send(channelKey, content);
      return {
        success: true,
        output: `Message sent to ${target}: ${result}`,
      };
    } catch (err) {
      return {
        success: false,
        output: "",
        error: `Failed to send message: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  registerIntegration(name: string, integration: MessagingIntegration): void {
    this.integrations.set(name, integration);
  }

  unregisterIntegration(name: string): void {
    this.integrations.delete(name);
  }

  hasIntegration(name: string): boolean {
    return this.integrations.has(name);
  }
}
