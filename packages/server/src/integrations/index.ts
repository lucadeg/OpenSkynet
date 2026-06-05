import { IntegrationConfig } from "./config";
import type { BaseAdapter, SendResult } from "../gateway/base";
import { DiscordAdapter } from "./discord/adapter";
import { TelegramAdapter } from "./telegram/adapter";
import { SlackAdapter } from "./slack/adapter";
import { WhatsAppAdapter } from "./whatsapp/adapter";
import { LarkAdapter } from "./lark/adapter";
import { WeChatAdapter } from "./wechat/adapter";
import type { GatewayRunner } from "../gateway/runner";
import type { ToolDefinition } from "../core/types";

export interface IntegrationInfo {
  name: string;
  enabled: boolean;
  configured: boolean;
  connected: boolean;
}

interface ManagedAdapter extends BaseAdapter {
  configure(config: Record<string, unknown>): Promise<void>;
}

const registry: Map<string, ManagedAdapter> = new Map();
let configStore: IntegrationConfig | null = null;
let gatewayRunner: GatewayRunner | null = null;

function getConfigStore(): IntegrationConfig {
  if (!configStore) {
    const { join } = require("node:path");
    const { homedir } = require("node:os");
    const dataDir = process.env.SEDIMAN_DATA_DIR || join(homedir(), ".terminator");
    configStore = new IntegrationConfig(join(dataDir, "integrations.json"));
  }
  return configStore;
}

export function listIntegrations(): Record<string, IntegrationInfo> {
  const result: Record<string, IntegrationInfo> = {};
  for (const [name, adapter] of registry) {
    result[name] = {
      name,
      enabled: true,
      configured: true,
      connected: adapter.isConnected(),
    };
  }
  return result;
}

export async function configureIntegration(
  name: string,
  config: Record<string, unknown>,
): Promise<void> {
  const adapter = registry.get(name);
  if (!adapter) throw new Error(`Unknown integration: ${name}`);
  await adapter.configure(config);
  getConfigStore().set(name, config);
}

export async function sendMessage(
  integration: string,
  target: string,
  content: string,
): Promise<{ result: string }> {
  const adapter = registry.get(integration);
  if (!adapter) throw new Error(`Unknown integration: ${integration}`);
  const res: SendResult = await adapter.send(target, content);
  if (!res.success) return { result: `Error: ${res.error ?? "unknown"}` };
  return { result: res.messageId ?? "sent" };
}

export function getIntegration(name: string): ManagedAdapter | null {
  return registry.get(name) ?? null;
}

export function setupIntegrations(): void {
  const adapters: ManagedAdapter[] = [
    new DiscordAdapter(),
    new TelegramAdapter(),
    new SlackAdapter(),
    new WhatsAppAdapter(),
    new LarkAdapter(),
    new WeChatAdapter(),
  ];
  for (const adapter of adapters) {
    registry.set(adapter.platform, adapter);
  }
}

export async function startListeners(): Promise<void> {
  const store = getConfigStore();
  const configs = store.list();
  for (const [name, adapter] of registry) {
    const saved = configs[name];
    if (saved) {
      await adapter.configure(saved).catch(() => {});
      await adapter.start().catch(() => {});
    }
  }
}

export async function stopListeners(): Promise<void> {
  for (const adapter of registry.values()) {
    await adapter.stop().catch(() => {});
  }
}

export function setGatewayRunner(runner: GatewayRunner): void {
  gatewayRunner = runner;
}

export function getTools(): ToolDefinition[] {
  return [
    {
      name: "integration_send",
      description: "Send a message via a platform integration",
      parameters: {
        type: "object",
        properties: {
          integration: { type: "string", description: "Integration name" },
          target: { type: "string", description: "Target channel or user ID" },
          content: { type: "string", description: "Message content" },
        },
        required: ["integration", "target", "content"],
      },
    },
    {
      name: "integration_list",
      description: "List all configured integrations and their status",
      parameters: { type: "object", properties: {} },
    },
  ];
}
