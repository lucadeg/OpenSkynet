import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerTerminalHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("terminal.set", async (params) => {
    const allowed = params.allowed as boolean;
    deps.terminalAllowed = allowed;
    return { set: true, allowed };
  });

  server.register("terminal.status", async () => {
    return { allowed: deps.terminalAllowed };
  });
}
