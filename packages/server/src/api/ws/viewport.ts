import type { WSContext } from "hono/ws";
import type { ApiDeps } from "../app";

const clients = new Set<WSContext>();
let intervalId: ReturnType<typeof setInterval> | null = null;

export function handleViewportOpen(ws: WSContext, deps: ApiDeps): void {
  clients.add(ws);

  if (!intervalId) {
    intervalId = setInterval(async () => {
      if (clients.size === 0) {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        return;
      }

      if (!deps.browserSession.isStarted) return;

      try {
        const screenshot = await deps.browserSession.takeScreenshot();
        if (!screenshot) return;

        const payload = JSON.stringify({
          type: "frame",
          screenshot,
          timestamp: Date.now(),
        });

        for (const client of clients) {
          if (client.readyState === 1) {
            client.send(payload);
          }
        }
      } catch {
        // ignore screenshot failures
      }
    }, 1000);
  }
}

export function handleViewportClose(ws: WSContext): void {
  clients.delete(ws);
  if (clients.size === 0 && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
