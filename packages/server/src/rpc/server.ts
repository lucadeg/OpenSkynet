import { Server as UnixServer, type Socket } from "node:net";
import { createInterface } from "node:readline";
import type { RPCRequest, RPCNotification, RPCResponse } from "../core/types";
import { ERROR_CODES } from "./protocol";
import logger from "../core/logging";

export type NotifyFn = (method: string, params: Record<string, unknown>) => void;
export type RPCHandler = (
  params: Record<string, unknown>,
  notify?: NotifyFn,
) => Promise<unknown>;

export interface DispatchResult {
  response: RPCResponse;
  handler?: RPCHandler;
  params?: Record<string, unknown>;
  notify?: NotifyFn;
}

export class RPCServer {
  private server: UnixServer | null = null;
  private startTime = Date.now();

  handlers: Map<string, RPCHandler> = new Map();

  register(method: string, handler: RPCHandler): void {
    this.handlers.set(method, handler);
  }

  registerBatch(methods: Record<string, RPCHandler>): void {
    for (const [method, handler] of Object.entries(methods)) {
      this.handlers.set(method, handler);
    }
  }

  async listen(socketPath?: string): Promise<void> {
    const path = socketPath ?? "/tmp/sediman.sock";
    this.server = new UnixServer();

    this.server.on("connection", (socket) => this.handleConnection(socket));

    this.server.on("error", (err) => {
      logger.error({ err: (err as Error).message }, "rpc_server_error");
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(path, () => {
        logger.info({ path }, "rpc_server_listening");
        resolve();
      });
      this.server!.once("error", reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
    this.server = null;
    logger.info("rpc_server_stopped");
  }

  getUptimeSecs(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  dispatch(parsed: unknown, notify?: NotifyFn): DispatchResult {
    if (!parsed || typeof parsed !== "object") {
      return {
        response: {
          jsonrpc: "2.0",
          id: null,
          error: { code: ERROR_CODES.INVALID_REQUEST, message: "Invalid Request" },
        },
      };
    }

    const req = parsed as Partial<RPCRequest>;

    if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      return {
        response: {
          jsonrpc: "2.0",
          id: req.id ?? null,
          error: { code: ERROR_CODES.INVALID_REQUEST, message: "Invalid Request" },
        },
      };
    }

    const handler = this.handlers.get(req.method);

    if (req.id === undefined || req.id === null) {
      if (handler) {
        handler(req.params ?? {}, notify).catch(() => {});
      }
      return { response: null as unknown as RPCResponse };
    }

    if (!handler) {
      return {
        response: {
          jsonrpc: "2.0",
          id: req.id,
          error: {
            code: ERROR_CODES.METHOD_NOT_FOUND,
            message: `Method not found: ${req.method}`,
          },
        },
      };
    }

    return {
      response: { jsonrpc: "2.0", id: req.id } as RPCResponse,
      handler,
      params: req.params ?? {},
      notify,
    };
  }

  private handleConnection(socket: Socket): void {
    const notify: NotifyFn = (method, params) => {
      const notification: RPCNotification = {
        jsonrpc: "2.0",
        method,
        params,
      };
      this.writeLine(socket, notification);
    };

    const rl = createInterface({ input: socket });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        this.writeLine(socket, {
          jsonrpc: "2.0",
          id: null,
          error: { code: ERROR_CODES.PARSE_ERROR, message: "Parse error" },
        });
        return;
      }

      this.executeAndRespond(parsed, notify)
        .then((response) => {
          if (response) this.writeLine(socket, response);
        })
        .catch((err) => {
          logger.error({ err: (err as Error).message }, "rpc_handler_error");
        });
    });

    socket.on("error", (err) => {
      logger.debug({ err: (err as Error).message }, "rpc_socket_error");
    });
  }

  async executeAndRespond(
    parsed: unknown,
    notify?: NotifyFn,
  ): Promise<RPCResponse | null> {
    const result = this.dispatch(parsed, notify);

    if (result.handler) {
      try {
        const value = await result.handler(result.params!, result.notify);
        return {
          jsonrpc: "2.0",
          id: result.response.id!,
          result: value,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          jsonrpc: "2.0",
          id: result.response.id!,
          error: { code: ERROR_CODES.INTERNAL_ERROR, message },
        };
      }
    }

    return result.response;
  }

  private writeLine(socket: Socket, data: unknown): void {
    try {
      if (socket.destroyed || socket.closed) return;
      socket.write(JSON.stringify(data) + "\n");
    } catch {
      // socket may have closed
    }
  }
}
