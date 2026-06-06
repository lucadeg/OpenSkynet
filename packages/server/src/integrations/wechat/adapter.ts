import { BaseAdapter, type SendResult } from "../../gateway/base";

export class WeChatAdapter extends BaseAdapter {
  private corpId: string | null = null;
  private corpSecret: string | null = null;
  private agentId: number | null = null;
  private accessToken: string | null = null;
  private _connected = false;

  get platform(): string {
    return "wechat";
  }

  async configure(config: Record<string, unknown>): Promise<void> {
    this.corpId = config.corpId as string;
    this.corpSecret = config.corpSecret as string;
    this.agentId = config.agentId as number;
  }

  async start(): Promise<void> {
    if (!this.corpId || !this.corpSecret) throw new Error("WeChat not configured");
    await this.refreshToken();
    this._connected = true;
  }

  async stop(): Promise<void> {
    this.accessToken = null;
    this._connected = false;
  }

  async send(target: string, content: string): Promise<SendResult> {
    if (!this.accessToken) await this.refreshToken();
    try {
      const res = await fetch(
        `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${this.accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            touser: target,
            msgtype: "text",
            agentid: this.agentId,
            text: { content },
          }),
        },
      );
      const data = await res.json() as any;
      if (data.errcode !== 0) return { success: false, error: data.errmsg ?? "WeChat API error" };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  private async refreshToken(): Promise<void> {
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${this.corpSecret}`,
    );
    const data = await res.json() as any;
    this.accessToken = data.access_token ?? null;
  }
}
