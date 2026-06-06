import type { WSContext } from "hono/ws";
import type { NotifyFn, RPCHandler } from "../../rpc/server";
import type { RPCHandlerDeps } from "../../rpc/deps";
import { buildHandlerMap } from "../../rpc";
import { ERROR_CODES } from "../../rpc/protocol";
import type { RPCRequest, RPCNotification } from "../../core/types";
import logger from "../../core/logging";

export interface WSRPCOptions {
  deps: RPCHandlerDeps;
}

export function handleRPCOpen(ws: WSContext, opts: WSRPCOptions): void {
  const startTime = Date.now();
  const handlerMap = buildHandlerMap(opts.deps, () =>
    Math.floor((Date.now() - startTime) / 1000),
  );

  const notify: NotifyFn = (method, params) => {
    const notification: RPCNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };
    try {
      ws.send(JSON.stringify(notification));
    } catch {}
  };

  const raw = (ws as any).raw;
  let closed = false;

  raw.__rpcOnMessage = async (rawMsg: string) => {
    if (closed) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawMsg);
    } catch {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: ERROR_CODES.PARSE_ERROR, message: "Parse error" },
        }),
      );
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: ERROR_CODES.INVALID_REQUEST, message: "Invalid Request" },
        }),
      );
      return;
    }

    const req = parsed as Partial<RPCRequest>;

    if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id ?? null,
          error: { code: ERROR_CODES.INVALID_REQUEST, message: "Invalid Request" },
        }),
      );
      return;
    }

    const handler: RPCHandler | undefined = handlerMap.get(req.method);

    if (req.id === undefined || req.id === null) {
      if (handler) {
        handler(req.params ?? {}, notify).catch(() => {});
      }
      return;
    }

    if (!handler) {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          error: {
            code: ERROR_CODES.METHOD_NOT_FOUND,
            message: `Method not found: ${req.method}`,
          },
        }),
      );
      return;
    }

    try {
      const result = await handler(req.params ?? {}, notify);
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          result,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: ERROR_CODES.INTERNAL_ERROR, message },
        }),
      );
    }
  };

  raw.__rpcOnClose = () => {
    closed = true;
  };
}

export function handleRPCClose(ws: WSContext): void {
  const raw = (ws as any).raw;
  raw.__rpcOnClose?.();
}

export function handleRPCMessage(
  ws: WSContext,
  message: string | ArrayBuffer,
): void {
  const data = typeof message === "string" ? message : new TextDecoder().decode(message);
  const raw = (ws as any).raw;
  raw.__rpcOnMessage?.(data);
}
