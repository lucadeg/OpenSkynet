import { BaseAdapter, type SendResult } from "../../gateway/base";

export class LarkAdapter extends BaseAdapter {
  private appId: string | null = null;
  private appSecret: string | null = null;
  private tenantToken: string | null = null;
  private _connected = false;

  get platform(): string {
    return "lark";
  }

  async configure(config: Record<string, unknown>): Promise<void> {
    this.appId = config.appId as string;
    this.appSecret = config.appSecret as string;
  }

  async start(): Promise<void> {
    if (!this.appId || !this.appSecret) throw new Error("Lark not configured");
    await this.refreshToken();
    this._connected = true;
  }

  async stop(): Promise<void> {
    this.tenantToken = null;
    this._connected = false;
  }

  async send(target: string, content: string): Promise<SendResult> {
    if (!this.tenantToken) {
      await this.refreshToken();
    }
    try {
      const res = await fetch(
        `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.tenantToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receive_id: target,
            msg_type: "text",
            content: JSON.stringify({ text: content }),
          }),
        },
      );
      const data = await res.json() as any;
      if (data.code !== 0) return { success: false, error: data.msg ?? "Lark API error" };
      return { success: true, messageId: data.data?.message_id };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  private async refreshToken(): Promise<void> {
    const res = await fetch(
      "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
      },
    );
    const data = await res.json() as any;
    this.tenantToken = data.tenant_access_token ?? null;
  }
}
