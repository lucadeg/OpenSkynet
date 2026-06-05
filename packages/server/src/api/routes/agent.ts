import { Hono } from "hono";
import { sseHeaders, sseEvent } from "../sse";
import type { AgentLoop } from "../../agent/loop";
import type { LLMProvider } from "../../llm/provider";

export function createAgentRoutes(deps: {
  agentLoop: AgentLoop;
  llmProvider: LLMProvider;
}): Hono {
  const router = new Hono();

  router.post("/run", async (c) => {
    const body = await c.req.json<{ task: string; mode?: string }>();
    if (!body.task?.trim()) {
      return c.json(
        { error: "VALIDATION_ERROR", message: "task is required" },
        400,
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        };

        const provider = deps.llmProvider as unknown as Record<string, unknown>;
        const origTokenCb = provider._tokenCallback as
          | ((tokens: number) => void)
          | null;

        provider._tokenCallback = (tokens: number) => {
          enqueue("token", { delta: tokens, phase: "responding" });
        };

        try {
          const result = await deps.agentLoop.run(body.task, body.mode);

          for (const step of result.steps) {
            enqueue("step", {
              phase: step.phase,
              action: `[${step.action.toUpperCase()}] ${step.action}`,
              detail: step.detail,
              observation: step.observation,
            });
          }

          enqueue("done", {
            success: result.success,
            result: result.result,
            strategy_used: result.strategy_used,
            iterations: result.iterations,
            elapsed_secs: result.elapsed_secs,
          });
        } catch (err) {
          enqueue("done", {
            success: false,
            result: err instanceof Error ? err.message : String(err),
          });
        } finally {
          provider._tokenCallback = origTokenCb;
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  });

  return router;
}
