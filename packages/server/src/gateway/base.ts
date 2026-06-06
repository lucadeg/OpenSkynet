export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export abstract class BaseAdapter {
  abstract get platform(): string;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(target: string, content: string): Promise<SendResult>;
  abstract isConnected(): boolean;
}
