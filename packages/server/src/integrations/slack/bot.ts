import { WebClient, type ChatPostMessageResponse } from "@slack/web-api";
import type { SendResult } from "../../gateway/base";
import type { MessageEvent } from "../../gateway/events";

export class SlackBot {
  private client: WebClient;
  private token: string;
  private onMessage: (event: MessageEvent) => void;
  private socketMode: any = null;

  constructor(token: string, onMessage: (event: MessageEvent) => void) {
    this.token = token;
    this.onMessage = onMessage;
    this.client = new WebClient(token);
  }

  async start(): Promise<void> {
    const appToken = process.env.SLACK_APP_TOKEN;
    if (appToken) {
      const { SocketModeClient } = await import("@slack/socket-mode");
      this.socketMode = new SocketModeClient({ appToken });
      this.socketMode.on("message", (event: any) => {
        const msg = event.body?.event;
        if (!msg || msg.bot_id || msg.subtype) return;
        this.onMessage({
          channelId: msg.channel,
          channelName: msg.channel ?? undefined,
          userId: msg.user,
          userName: msg.user,
          content: msg.text ?? "",
          platform: "slack",
          isCommand: (msg.text ?? "").startsWith("/"),
          timestamp: msg.ts ?? new Date().toISOString(),
        });
      });
      await this.socketMode.start();
    }
  }

  async stop(): Promise<void> {
    if (this.socketMode) {
      await this.socketMode.disconnect();
      this.socketMode = null;
    }
  }

  async send(channelId: string, content: string): Promise<SendResult> {
    try {
      const result: ChatPostMessageResponse = await this.client.chat.postMessage({
        channel: channelId,
        text: content,
      });
      return { success: true, messageId: result.ts ?? undefined };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  }

  /**
   * Get the underlying WebClient instance.
   */
  getClient(): WebClient {
    return this.client;
  }

  /**
   * Check if Socket Mode is active.
   */
  isSocketModeActive(): boolean {
    return this.socketMode !== null;
  }
}
