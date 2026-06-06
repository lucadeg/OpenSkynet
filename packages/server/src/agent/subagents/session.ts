import { randomUUID } from "crypto";

export class SubagentSession {
  id: string;
  mode: string;
  status: "idle" | "running" | "done" | "failed";
  result?: string;

  private abortController: AbortController | null = null;

  constructor(id: string, mode: string) {
    this.id = id ?? randomUUID();
    this.mode = mode;
    this.status = "idle";
  }

  async run(task: string): Promise<string> {
    this.status = "running";
    this.abortController = new AbortController();

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, 100);
        this.abortController!.signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new Error("Session cancelled"));
        });
      });

      this.result = `[${this.mode}] completed: ${task}`;
      this.status = "done";
      return this.result;
    } catch (err) {
      this.status = "failed";
      this.result = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.abortController = null;
    }
  }

  cancel(): void {
    this.abortController?.abort();
  }
}
