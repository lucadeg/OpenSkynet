import type { WSContext } from "hono/ws";
import type { ApiDeps } from "../app";

const sessionClients = new Map<string, Set<WSContext>>();

export function handleRecordOpen(
  ws: WSContext,
  sessionId: string,
  deps: ApiDeps,
): void {
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set());
  }
  sessionClients.get(sessionId)!.add(ws);
}

export function handleRecordClose(
  ws: WSContext,
  sessionId: string,
): void {
  const set = sessionClients.get(sessionId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) sessionClients.delete(sessionId);
  }
}

export function pushFrame(
  sessionId: string,
  frame: Record<string, unknown>,
): void {
  const set = sessionClients.get(sessionId);
  if (!set) return;
  const payload = JSON.stringify({ type: "frame", ...frame });
  for (const client of set) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
