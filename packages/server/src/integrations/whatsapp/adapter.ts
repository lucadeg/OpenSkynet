import { BaseAdapter, type SendResult } from "../../gateway/base";

export class WhatsAppAdapter extends BaseAdapter {
  private token: string | null = null;
  private phoneNumberId: string | null = null;
  private verifyToken: string | null = null;
  private _connected = false;

  get platform(): string {
    return "whatsapp";
  }

  async configure(config: Record<string, unknown>): Promise<void> {
    this.token = config.token as string;
    this.phoneNumberId = config.phoneNumberId as string;
    this.verifyToken = config.verifyToken as string;
  }

  async start(): Promise<void> {
    if (!this.token || !this.phoneNumberId) throw new Error("WhatsApp not configured");
    this._connected = true;
  }

  async stop(): Promise<void> {
    this._connected = false;
  }

  async send(target: string, content: string): Promise<SendResult> {
    try {
      const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: target,
          type: "text",
          text: { body: content },
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) return { success: false, error: data.error?.message ?? "WhatsApp API error" };
      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  getVerifyToken(): string | null {
    return this.verifyToken;
  }
}
