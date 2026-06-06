import { readFileSync, writeFileSync, existsSync } from "node:fs";

export class IntegrationConfig {
  private path: string;
  private data: Record<string, Record<string, unknown>> = {};

  constructor(path: string) {
    this.path = path;
    this.load();
  }

  get(name: string): Record<string, unknown> | null {
    return this.data[name] ?? null;
  }

  set(name: string, config: Record<string, unknown>): void {
    this.data[name] = config;
    this.flush();
  }

  remove(name: string): boolean {
    if (!(name in this.data)) return false;
    delete this.data[name];
    this.flush();
    return true;
  }

  list(): Record<string, Record<string, unknown>> {
    return { ...this.data };
  }

  private load(): void {
    if (!existsSync(this.path)) return;
    try {
      const raw = readFileSync(this.path, "utf-8");
      this.data = JSON.parse(raw);
    } catch {
      this.data = {};
    }
  }

  private flush(): void {
    writeFileSync(this.path, JSON.stringify(this.data, null, 2), "utf-8");
  }
}
