export { RPCServer, type RPCHandler, type NotifyFn } from "./server.js";
export { ERROR_CODES } from "./protocol.js";
export type { RPCHandlerDeps } from "./deps.js";

import { RPCServer } from "./server.js";
import type { RPCHandlerDeps } from "./deps.js";
import type { RPCHandler } from "./server.js";
import { registerSystemHandlers } from "./handlers/system.js";
import { registerAgentHandlers } from "./handlers/agent.js";
import { registerBrowserHandlers } from "./handlers/browser.js";
import { registerSkillHandlers } from "./handlers/skills.js";
import { registerHubHandlers } from "./handlers/hub.js";
import { registerMemoryHandlers } from "./handlers/memory.js";
import { registerSessionHandlers } from "./handlers/sessions.js";
import { registerScheduleHandlers } from "./handlers/schedule.js";
import { registerModelHandlers } from "./handlers/model.js";
import { registerAuthHandlers } from "./handlers/auth.js";
import { registerTerminalHandlers } from "./handlers/terminal.js";
import { registerRecordHandlers } from "./handlers/record.js";
import { registerIntegrationHandlers } from "./handlers/integration.js";
import { registerCheckpointHandlers } from "./handlers/checkpoint.js";
import { registerSandboxHandlers } from "./handlers/sandbox.js";

export function buildHandlerMap(
  deps: RPCHandlerDeps,
  getUptimeSecs: () => number,
): Map<string, RPCHandler> {
  const handlerMap = new Map<string, RPCHandler>();
  const register = (method: string, handler: RPCHandler) => {
    handlerMap.set(method, handler);
  };

  const fakeServer = {
    register,
    handlers: handlerMap as Map<string, RPCHandler>,
    getUptimeSecs,
  } as unknown as RPCServer;

  registerSystemHandlers(fakeServer, deps);
  registerAgentHandlers(fakeServer, deps);
  registerBrowserHandlers(fakeServer, deps);
  registerSkillHandlers(fakeServer, deps);
  registerHubHandlers(fakeServer, deps);
  registerMemoryHandlers(fakeServer, deps);
  registerSessionHandlers(fakeServer, deps);
  registerScheduleHandlers(fakeServer, deps);
  registerModelHandlers(fakeServer, deps);
  registerAuthHandlers(fakeServer, deps);
  registerTerminalHandlers(fakeServer, deps);
  registerRecordHandlers(fakeServer, deps);
  registerIntegrationHandlers(fakeServer, deps);
  registerCheckpointHandlers(fakeServer, deps);
  registerSandboxHandlers(fakeServer, deps);

  return handlerMap;
}

export function createRPCServer(deps: RPCHandlerDeps): RPCServer {
  const server = new RPCServer();
  const handlerMap = buildHandlerMap(deps, () => server.getUptimeSecs());
  for (const [method, handler] of handlerMap) {
    server.register(method, handler);
  }
  return server;
}
