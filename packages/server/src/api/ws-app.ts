import { Hono } from "hono";
import type { WSContext, UpgradeWebSocket } from "hono/ws";
import type { ApiDeps } from "./app";
import { handleChatOpen, handleChatClose, handleChatMessage } from "./ws/chat";
import { handleViewportOpen, handleViewportClose } from "./ws/viewport";
import { handleRecordOpen, handleRecordClose } from "./ws/record";
import { handleRPCOpen, handleRPCClose, handleRPCMessage } from "./ws/rpc";
import type { WSRPCOptions } from "./ws/rpc";
import type { RPCHandlerDeps } from "../rpc/deps";

export interface WSDeps extends ApiDeps {
  rpcDeps?: RPCHandlerDeps;
}

export function createWSApp(
  deps: WSDeps,
  upgradeWebSocket: UpgradeWebSocket,
): Hono {
  const app = new Hono();

  app.get(
    "/ws/chat",
    upgradeWebSocket(() => ({
      onOpen(_ev, ws) {
        handleChatOpen(ws as unknown as WSContext);
      },
      onClose(_ev, ws) {
        handleChatClose(ws as unknown as WSContext);
      },
      onMessage(ev, ws) {
        handleChatMessage(ws as unknown as WSContext, ev.data, deps);
      },
    })),
  );

  app.get(
    "/ws/viewport",
    upgradeWebSocket(() => ({
      onOpen(_ev, ws) {
        handleViewportOpen(ws as unknown as WSContext, deps);
      },
      onClose(_ev, ws) {
        handleViewportClose(ws as unknown as WSContext);
      },
    })),
  );

  app.get(
    "/ws/record/:sessionId",
    upgradeWebSocket((c) => {
      const sessionId = c.req.param("sessionId")!;
      return {
        onOpen(_ev, ws) {
          handleRecordOpen(ws as unknown as WSContext, sessionId, deps);
        },
        onClose(_ev, ws) {
          handleRecordClose(ws as unknown as WSContext, sessionId);
        },
      };
    }),
  );

  if (deps.rpcDeps) {
    const rpcOpts: WSRPCOptions = { deps: deps.rpcDeps };
    app.get(
      "/ws/rpc",
      upgradeWebSocket(() => ({
        onOpen(_ev, ws) {
          handleRPCOpen(ws as unknown as WSContext, rpcOpts);
        },
        onClose(_ev, ws) {
          handleRPCClose(ws as unknown as WSContext);
        },
        onMessage(ev, ws) {
          handleRPCMessage(ws as unknown as WSContext, ev.data as string);
        },
      })),
    );
  }

  return app;
}
