import { BaseAdapter } from "./base";
import type { MessageEvent } from "./events";
import { formatAgentResult, truncateMessage } from "./helpers";

export class GatewayRunner {
  private adapters: Map<string, BaseAdapter> = new Map();
  private agentRunner: ((task: string) => Promise<string>) | null = null;
  private allowedUsers: Set<string> = new Set();
  private allowedServers: Set<string> = new Set();
  private homeChannelId: string | null = null;
  private homePlatform: string | null = null;

  registerAdapter(adapter: BaseAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  unregisterAdapter(platform: string): void {
    this.adapters.delete(platform);
  }

  setAgentRunner(runner: (task: string) => Promise<string>): void {
    this.agentRunner = runner;
  }

  setAllowedUsers(users: string[]): void {
    this.allowedUsers = new Set(users);
  }

  setAllowedServers(servers: string[]): void {
    this.allowedServers = new Set(servers);
  }

  setHomeChannel(channelId: string): void {
    this.homeChannelId = channelId;
  }

  async start(): Promise<void> {
    const entries = [...this.adapters.values()];
    await Promise.all(entries.map((a) => a.start().catch(() => {})));
  }

  async stop(): Promise<void> {
    const entries = [...this.adapters.values()];
    await Promise.all(entries.map((a) => a.stop().catch(() => {})));
  }

  async deliverToHome(content: string): Promise<void> {
    if (!this.homeChannelId) return;
    const adapter = this.homePlatform
      ? this.adapters.get(this.homePlatform)
      : [...this.adapters.values()].find(() => true);
    if (!adapter) return;
    await adapter.send(this.homeChannelId, content).catch(() => {});
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    if (!this.isAuthorized(event)) return;
    if (!this.agentRunner) return;

    const task = event.isCommand
      ? event.content.replace(/^\/\S+\s*/, "").trim()
      : event.content.trim();
    if (!task) return;

    try {
      const result = await this.agentRunner(task);
      const adapter = this.adapters.get(event.platform);
      if (adapter) {
        await adapter.send(event.channelId, truncateMessage(formatAgentResult(result)));
      }
    } catch {
      const adapter = this.adapters.get(event.platform);
      if (adapter) {
        await adapter.send(event.channelId, "Error processing request.").catch(() => {});
      }
    }
  }

  private isAuthorized(event: MessageEvent): boolean {
    if (this.allowedUsers.size > 0 && !this.allowedUsers.has(event.userId)) return false;
    if (this.allowedServers.size > 0 && event.channelId && !this.allowedServers.has(event.channelId)) return false;
    return true;
  }
}
