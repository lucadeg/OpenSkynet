import { spawn } from "bun";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { SidecarRequest, SidecarResponse, SidecarEvent, RunTaskOptions, RunTaskResult } from "./types";

type StdinPipe = { write(data: string): void; flush(): void };
type StdoutPipe = ReadableStream<Uint8Array>;

export class BrowserUseBridge {
  private process: ReturnType<typeof spawn> | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private eventHandlers: Array<(event: SidecarEvent) => void> = [];
  private buffer = "";

  async start(opts: {
    provider: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    headless?: boolean;
  }): Promise<void> {
    const sidecarDir = join(import.meta.dir);
    this.process = spawn({
      cmd: ["python3", join(sidecarDir, "sidecar.py")],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        OPENAI_API_KEY: opts.apiKey ?? "",
        SIDECAR_PROVIDER: opts.provider,
        SIDECAR_MODEL: opts.model,
        SIDECAR_BASE_URL: opts.baseUrl ?? "",
      },
    });

    this.readLoop();
    await this.sendRequest({
      type: "init",
      id: randomUUID(),
      payload: {
        provider: opts.provider,
        model: opts.model,
        api_key: opts.apiKey,
        base_url: opts.baseUrl,
        headless: opts.headless ?? true,
      },
    });
  }

  async runTask(opts: RunTaskOptions): Promise<RunTaskResult> {
    const result = await this.sendRequest({
      type: "run_task",
      id: randomUUID(),
      payload: {
        task: opts.task,
        max_steps: opts.max_steps,
        flash_mode: opts.flash_mode,
        system_prompt: opts.system_prompt,
        use_vision: opts.use_vision,
      },
    });
    return result as RunTaskResult;
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    try {
      await this.sendRequest({ type: "stop", id: randomUUID(), payload: {} }, 5000);
    } catch {
      // swallow timeout on stop
    }
    this.process.kill();
    await this.process.exited;
    this.process = null;
  }

  async screenshot(): Promise<string | null> {
    const result = await this.sendRequest({
      type: "screenshot",
      id: randomUUID(),
      payload: {},
    });
    return (result as string | null) ?? null;
  }

  onEvent(handler: (event: SidecarEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  private sendRequest(req: SidecarRequest, timeoutMs = 0): Promise<unknown> {
    this.ensureRunning();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(req.id, { resolve, reject });
      const data = JSON.stringify(req) + "\n";
      const stdin = this.process!.stdin as unknown as StdinPipe;
      stdin.write(data);
      stdin.flush();

      if (timeoutMs > 0) {
        setTimeout(() => {
          if (this.pendingRequests.has(req.id)) {
            this.pendingRequests.delete(req.id);
            reject(new Error(`Request ${req.id} timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }
    });
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    let parsed: SidecarResponse | SidecarEvent;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }

    if ("id" in parsed && ("success" in parsed || "error" in parsed)) {
      const resp = parsed as SidecarResponse;
      const pending = this.pendingRequests.get(resp.id);
      if (pending) {
        this.pendingRequests.delete(resp.id);
        if (resp.success) {
          pending.resolve(resp.result);
        } else {
          pending.reject(new Error(resp.error ?? "Unknown sidecar error"));
        }
      }
    } else if ("type" in parsed && "data" in parsed) {
      const evt = parsed as SidecarEvent;
      for (const handler of this.eventHandlers) {
        handler(evt);
      }
    }
  }

  private ensureRunning(): void {
    if (!this.process) {
      throw new Error("BrowserUseBridge is not started");
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.process) return;
    const stdout = this.process.stdout as unknown as StdoutPipe;
    const reader = stdout.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        this.buffer += decoder.decode(value, { stream: true });
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? "";
        for (const line of lines) {
          this.handleLine(line);
        }
      }
    } catch {
      // stream closed
    }
  }
}
