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

        // Subscribe to agent loop streaming events
        const unsubscribe = deps.agentLoop.onStreamEvent((streamEvent) => {
          switch (streamEvent.type) {
            case 'step_start':
              enqueue("progress", {
                phase: streamEvent.phase,
                action: streamEvent.action,
                detail: streamEvent.detail,
                url: streamEvent.url,
              });
              break;
            case 'step_complete':
              enqueue("progress", {
                phase: streamEvent.phase,
                action: streamEvent.action,
                observation: streamEvent.observation,
                success: streamEvent.success,
              });
              break;
            case 'thinking':
              enqueue("chunk", { delta: streamEvent.content, phase: streamEvent.phase });
              break;
            case 'content':
              enqueue("chunk", { delta: streamEvent.content, phase: "responding" });
              break;
            case 'progress':
              enqueue("progress", {
                phase: streamEvent.phase,
                iteration: streamEvent.iteration,
                maxIterations: streamEvent.maxIterations,
              });
              break;
            case 'error':
              enqueue("error", { error: streamEvent.error });
              break;
          }
        });

        try {
          const result = await deps.agentLoop.run(body.task, body.mode);

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
          unsubscribe();
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  });

  return router;
}
