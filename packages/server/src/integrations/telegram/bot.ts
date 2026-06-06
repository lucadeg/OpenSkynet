import { Bot, type Context } from "grammy";
import type { SendResult } from "../../gateway/base";
import type { MessageEvent } from "../../gateway/events";

export class TelegramBot {
  private bot: Bot;
  private token: string;
  private onMessage: (event: MessageEvent) => void;
  private started = false;

  constructor(token: string, onMessage: (event: MessageEvent) => void) {
    this.token = token;
    this.onMessage = onMessage;
    this.bot = new Bot(token);
    this.bot.on("message:text", (ctx: Context) => {
      const msg = ctx.message!;
      this.onMessage({
        channelId: String(msg.chat.id),
        channelName: msg.chat.title ?? undefined,
        userId: String(msg.from!.id),
        userName: msg.from!.first_name,
        content: msg.text ?? "",
        platform: "telegram",
        isCommand: (msg.text ?? "").startsWith("/"),
        timestamp: new Date(msg.date * 1000).toISOString(),
      });
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    await this.bot.api.deleteWebhook({ drop_pending_updates: true });
    this.bot.start({ onStart: () => Promise.resolve() });
    this.started = true;
  }

  async stop(): Promise<void> {
    this.bot.stop();
    this.started = false;
  }

  async send(chatId: string, content: string): Promise<SendResult> {
    try {
      const result = await this.bot.api.sendMessage(chatId, content);
      return { success: true, messageId: String(result.message_id) };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  }

  /**
   * Get the underlying Grammy Bot instance.
   */
  getBot(): Bot {
    return this.bot;
  }

  /**
   * Get the bot token.
   */
  getToken(): string {
    return this.token;
  }

  /**
   * Check if the bot is started.
   */
  isStarted(): boolean {
    return this.started;
  }
}
