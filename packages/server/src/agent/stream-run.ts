import type { AgentResult, LLMResponse, ToolDefinition } from "../core/types";
import { AgentLoop } from "./loop";
import { ToolBus } from "./tools/bus";
import { createAgentToolRegistry } from "./tools/index";

export type AgentStreamEvent =
  | { type: "thinking"; token: string }
  | { type: "streaming"; token: string; phase: string }
  | { type: "step"; phase: string; action: string }
  | { type: "progress"; kind: "retry" | "validation" | "reflection"; data: any }
  | { type: "result"; result: any; success: boolean; elapsedSecs: number }
  | { type: "error"; message: string };

interface RunAgentStreamDeps {
  llmProvider: any;
  browserSession: any;
  memory: any;
  skillEngine: any;
  headless: boolean;
}

function createStreamQueue() {
  const buffer: AgentStreamEvent[] = [];
  const waiters: Array<(r: IteratorResult<AgentStreamEvent>) => void> = [];
  let closed = false;

  return {
    push(event: AgentStreamEvent): void {
      if (closed) return;
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value: event, done: false });
      } else {
        buffer.push(event);
      }
    },
    async pull(): Promise<IteratorResult<AgentStreamEvent>> {
      if (buffer.length > 0) {
        return { value: buffer.shift()!, done: false };
      }
      if (closed) {
        return { value: undefined, done: true };
      }
      return new Promise((resolve) => {
        waiters.push(resolve);
      });
    },
    close(): void {
      closed = true;
      for (const w of waiters) {
        w({ value: undefined, done: true });
      }
      waiters.length = 0;
    },
  };
}

function createStreamingLLMWrapper(
  inner: any,
  push: (e: AgentStreamEvent) => void,
): any {
  return {
    async chat(
      messages: any[],
      tools: ToolDefinition[],
      system?: string,
    ): Promise<LLMResponse> {
      push({ type: "thinking", token: "Thinking..." });

      try {
        const result = await inner.chatStreamWithTools(
          messages,
          tools,
          system,
          (token: string) => {
            push({ type: "streaming", token, phase: "executing" });
          },
        );
        return result;
      } catch {
        const result = await inner.chat(messages, tools, system);
        if (result.text) {
          const tokens = result.text.split(/(?<=\s)/);
          for (const token of tokens) {
            push({ type: "streaming", token, phase: "executing" });
          }
        }
        return result;
      }
    },
    chatStream(...args: any[]): any {
      return inner.chatStream(...args);
    },
    chatStreamWithTools(...args: any[]): any {
      return inner.chatStreamWithTools(...args);
    },
    chatWithFailover(...args: any[]): any {
      return inner.chatWithFailover(...args);
    },
    setTokenCallback(cb: any): void {
      if (typeof inner.setTokenCallback === "function") {
        inner.setTokenCallback(cb);
      }
    },
  };
}

function wrapToolBusForObservation(
  bus: ToolBus,
  push: (e: AgentStreamEvent) => void,
): ToolBus {
  const originalExecute = bus.execute.bind(bus);

  bus.execute = async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<any> => {
    push({ type: "step", phase: "executing", action: name });
    const result = await originalExecute(name, args);
    if (!result.success) {
      push({
        type: "progress",
        kind: "retry",
        data: { action: name, error: result.error },
      });
    }
    return result;
  };

  return bus;
}

export async function* runAgentStream(
  deps: RunAgentStreamDeps,
  task: string,
  options?: { mode?: string },
): AsyncGenerator<AgentStreamEvent> {
  const queue = createStreamQueue();
  const startTime = Date.now();

  const wrappedLLM = createStreamingLLMWrapper(deps.llmProvider, (e) =>
    queue.push(e),
  );

  const toolBus = createAgentToolRegistry({
    terminalAllowed: false,
    memoryManager: deps.memory,
    skillEngine: deps.skillEngine,
  });

  const observedBus = wrapToolBusForObservation(toolBus, (e) =>
    queue.push(e),
  );

  const loop = new AgentLoop({
    llmProvider: wrappedLLM,
    browserSession: deps.browserSession,
    memory: deps.memory,
    skillEngine: deps.skillEngine,
    toolBus: observedBus,
    headless: deps.headless,
  });

  const runPromise = loop.run(task, options?.mode).then(
    (result: AgentResult) => {
      const elapsedSecs = (Date.now() - startTime) / 1000;
      queue.push({
        type: "result",
        result: result.result,
        success: result.success,
        elapsedSecs: Math.round(elapsedSecs * 100) / 100,
      });
      queue.close();
    },
    (err: unknown) => {
      queue.push({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      queue.close();
    },
  );

  try {
    while (true) {
      const { value, done } = await queue.pull();
      if (done) break;
      yield value;
    }
  } finally {
    loop.cancel();
  }

  await runPromise;
}
