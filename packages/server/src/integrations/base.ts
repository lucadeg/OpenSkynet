export abstract class Integration {
  abstract get name(): string;
  abstract configure(config: Record<string, unknown>): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(target: string, content: string): Promise<{ result: string }>;
  abstract getStatus(): { enabled: boolean; configured: boolean; connected: boolean };
}
