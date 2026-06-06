import type { RPCServer, NotifyFn } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";
import type { StepEvent } from "../../core/types.js";

export function registerAgentHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("agent.run", async (params, notify) => {
    return runStreaming(params, notify, deps, (task, mode) =>
      deps.agentLoop.run(task, mode),
    );
  });

  server.register("agent.cancel", async () => {
    deps.agentLoop.cancel();
    return { cancelled: true };
  });

  server.register("agent.terminator", async (params, notify) => {
    const task = (params.task as string) ?? "";
    const mode = params.mode as string | undefined;

    const steps: StepEvent[] = [];
    const startTime = Date.now();

    notify!("chat.progress", {
      phase: "planning",
      action: "terminator_start",
      detail: task,
    });

    try {
      const result = await deps.agentLoop.run(task, mode);

      for (const step of result.steps) {
        notify!("chat.progress", {
          phase: step.phase,
          action: step.action,
          url: step.url,
          detail: step.detail,
          step: steps.length,
        });
        steps.push(step);
      }

      return result;
    } catch (err) {
      return {
        task,
        result: err instanceof Error ? err.message : String(err),
        success: false,
        steps,
        actions_taken: [],
        iterations: 0,
        strategy_used: "terminator",
        elapsed_secs: (Date.now() - startTime) / 1000,
      };
    }
  });

  server.register("agent.dispatch", async (params, notify) => {
    const task = (params.task as string) ?? "";
    const mode = params.mode as string | undefined;

    const startTime = Date.now();

    notify!("chat.progress", {
      phase: "planning",
      action: "dispatch_start",
      detail: task,
    });

    try {
      const result = await deps.agentLoop.run(task, mode);

      for (const step of result.steps) {
        notify!("chat.progress", {
          phase: step.phase,
          action: step.action,
          url: step.url,
          detail: step.detail,
          step: step.phase === "executing" ? 1 : 0,
        });
      }

      return result;
    } catch (err) {
      return {
        task,
        result: err instanceof Error ? err.message : String(err),
        success: false,
        steps: [],
        actions_taken: [],
        iterations: 0,
        strategy_used: "dispatch",
        elapsed_secs: (Date.now() - startTime) / 1000,
      };
    }
  });
}

async function runStreaming(
  params: Record<string, unknown>,
  notify: NotifyFn | undefined,
  deps: RPCHandlerDeps,
  runFn: (task: string, mode?: string) => Promise<import("../../core/types.js").AgentResult>,
): Promise<import("../../core/types.js").AgentResult> {
  const task = (params.task as string) ?? "";
  const mode = params.mode as string | undefined;

  const origCallback = (deps.llmProvider as any)._tokenCallback;
  (deps.llmProvider as any)._tokenCallback = (tokens: number) => {
    notify?.("chat.streaming", { token: String(tokens), phase: "executing" });
  };

  notify?.("chat.progress", { phase: "planning", action: "run_start", detail: task });

  try {
    const result = await runFn(task, mode);

    for (let i = 0; i < result.steps.length; i++) {
      const step = result.steps[i];
      notify?.("chat.progress", {
        phase: step.phase,
        action: step.action,
        url: step.url,
        detail: step.detail,
        step: i,
      });
    }

    return result;
  } finally {
    (deps.llmProvider as any)._tokenCallback = origCallback;
  }
}
