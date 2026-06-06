import type { WSContext, WSMessageReceive } from "hono/ws";
import type { ApiDeps } from "../app";

interface ChatClient {
  ws: WSContext;
  taskId?: string;
}

const clients = new Set<ChatClient>();

export function handleChatOpen(ws: WSContext): void {
  clients.add({ ws });
}

export function handleChatClose(ws: WSContext): void {
  for (const client of clients) {
    if (client.ws === ws) {
      clients.delete(client);
      break;
    }
  }
}

export async function handleChatMessage(
  ws: WSContext,
  message: WSMessageReceive,
  deps: ApiDeps,
): Promise<void> {
  const text = typeof message === "string" ? message : String(message);

  let parsed: { task?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { task: text };
  }

  const task = parsed.task ?? text;
  if (!task.trim()) {
    ws.send(JSON.stringify({ type: "error", message: "empty task" }));
    return;
  }

  ws.send(JSON.stringify({ type: "started", task }));

  try {
    const stream = deps.llmProvider.chatStream(
      [{ role: "user", content: task }],
      [],
    );

    for await (const token of stream) {
      if (ws.readyState !== 1) break;
      ws.send(JSON.stringify({ type: "token", content: token }));
    }

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "done" }));
    }
  } catch (err) {
    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
