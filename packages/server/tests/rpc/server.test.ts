import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { connect, type Socket } from "node:net";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RPCServer } from "../../src/rpc/server";
import { ERROR_CODES } from "../../src/rpc/protocol";

let dir: string;
let socketPath: string;
let server: RPCServer;

function sendAndReceive(socket: Socket, data: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 3000);
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const idx = buffer.indexOf("\n");
      if (idx !== -1) {
        clearTimeout(timeout);
        socket.removeListener("data", onData);
        resolve(buffer.slice(0, idx));
      }
    };
    socket.on("data", onData);
    socket.write(JSON.stringify(data) + "\n");
  });
}

function connectToServer(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("connect timeout")), 3000);
    const sock = connect(socketPath, () => {
      clearTimeout(timeout);
      resolve(sock);
    });
    sock.on("error", reject);
  });
}

describe("RPCServer", () => {
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "sediman-rpc-test-"));
    socketPath = join(dir, "test.sock");
    server = new RPCServer();
  });

  afterEach(async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  test("starts and creates socket file", async () => {
    await server.listen(socketPath);
    expect(existsSync(socketPath)).toBe(true);
  });

  test("handles valid JSON-RPC request and returns response", async () => {
    server.register("echo", async (params) => params);
    await server.listen(socketPath);

    const sock = await connectToServer();
    const response = JSON.parse(await sendAndReceive(sock, {
      jsonrpc: "2.0",
      id: 1,
      method: "echo",
      params: { message: "hello" },
    }));
    sock.destroy();

    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result).toEqual({ message: "hello" });
  });

  test("returns METHOD_NOT_FOUND for unknown method", async () => {
    await server.listen(socketPath);

    const sock = await connectToServer();
    const response = JSON.parse(await sendAndReceive(sock, {
      jsonrpc: "2.0",
      id: 2,
      method: "nonexistent",
      params: {},
    }));
    sock.destroy();

    expect(response.error.code).toBe(ERROR_CODES.METHOD_NOT_FOUND);
    expect(response.id).toBe(2);
  });

  test("returns PARSE_ERROR for invalid JSON", async () => {
    await server.listen(socketPath);

    const sock = await connectToServer();
    const response = await new Promise<string>((resolve) => {
      let buffer = "";
      const timeout = setTimeout(() => resolve(buffer), 2000);
      sock.on("data", (chunk) => {
        buffer += chunk.toString();
        const idx = buffer.indexOf("\n");
        if (idx !== -1) {
          clearTimeout(timeout);
          resolve(buffer.slice(0, idx));
        }
      });
      sock.write("this is not json\n");
    });
    sock.destroy();

    const parsed = JSON.parse(response);
    expect(parsed.error.code).toBe(ERROR_CODES.PARSE_ERROR);
  });

  test("handles multiple sequential requests on same connection", async () => {
    server.register("add", async (params) => {
      const a = Number(params.a);
      const b = Number(params.b);
      return { sum: a + b };
    });
    await server.listen(socketPath);

    const sock = await connectToServer();

    const r1 = JSON.parse(await sendAndReceive(sock, {
      jsonrpc: "2.0", id: 1, method: "add", params: { a: 2, b: 3 },
    }));
    const r2 = JSON.parse(await sendAndReceive(sock, {
      jsonrpc: "2.0", id: 2, method: "add", params: { a: 10, b: 20 },
    }));
    sock.destroy();

    expect(r1.result.sum).toBe(5);
    expect(r2.result.sum).toBe(30);
  });

  test("notifies via callback for streaming", async () => {
    const notifications: unknown[] = [];

    server.register("stream", async (_params, notify) => {
      notify!("progress", { step: 1 });
      notify!("progress", { step: 2 });
      return "done";
    });
    await server.listen(socketPath);

    const sock = await connectToServer();
    const messages: unknown[] = [];

    await new Promise<void>((resolve) => {
      let buffer = "";
      sock.on("data", (chunk) => {
        buffer += chunk.toString();
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          messages.push(JSON.parse(line));
          if (messages.length === 3) resolve();
        }
      });
      sock.write(JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "stream", params: {},
      }) + "\n");
    });
    sock.destroy();

    expect(messages.length).toBe(3);
    const notifs = messages.filter((m: any) => m.method === "progress");
    expect(notifs.length).toBe(2);
    const result = messages.find((m: any) => m.id === 1);
    expect(result.result).toBe("done");
  });
});
