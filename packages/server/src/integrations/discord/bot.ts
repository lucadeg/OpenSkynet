import { Client, GatewayIntentBits, type Message as DiscordMessage } from "discord.js";
import type { SendResult } from "../../gateway/base";
import type { MessageEvent } from "../../gateway/events";

export class DiscordBot {
  private client: Client;
  private token: string;
  private onMessage: (event: MessageEvent) => void;

  constructor(token: string, onMessage: (event: MessageEvent) => void) {
    this.token = token;
    this.onMessage = onMessage;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
    this.client.on("messageCreate", (msg: DiscordMessage) => {
      if (msg.author.bot) return;
      this.onMessage({
        channelId: msg.channelId,
        channelName: msg.guild?.name ?? undefined,
        userId: msg.author.id,
        userName: msg.author.username,
        content: msg.content,
        platform: "discord",
        isCommand: msg.content.startsWith("/"),
        timestamp: msg.createdTimestamp.toString(),
      });
    });
  }

  async start(): Promise<void> {
    await this.client.login(this.token);
  }

  async stop(): Promise<void> {
    this.client.destroy();
  }

  async send(channelId: string, content: string): Promise<SendResult> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isSendable()) {
        return { success: false, error: "Channel not found or not sendable" };
      }
      const message = await channel.send(content);
      return { success: true, messageId: message.id };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  }

  getClient(): Client {
    return this.client;
  }
}
