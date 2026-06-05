import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { createWSApp } from "../../src/api/ws-app";
import type { RPCHandlerDeps } from "../../src/rpc/deps";

const { upgradeWebSocket, websocket } = createBunWebSocket();

function makeMockRpcDeps(): RPCHandlerDeps {
  return {
    llmProvider: { chat: async () => ({ text: "test" }), chatStream: async () => [] as any[], listModels: async () => [] } as any,
    browserSession: { isStarted: false, takeScreenshot: async () => "", launch: async () => {}, close: async () => {} } as any,
    browserController: {} as any,
    memory: { get: async () => null, set: async () => {}, search: async () => [], delete: async () => {}, clear: async () => {} } as any,
    skillEngine: { listSkills: async () => [], getSkill: async () => null, createSkill: async () => {}, deleteSkill: async () => {} } as any,
    agentLoop: { run: async () => ({ status: "done" }), status: () => ({ running: false }) } as any,
    checkpointManager: {} as any,
    cronManager: { listJobs: async () => [], addJob: async () => {}, removeJob: async () => {} } as any,
    hubClient: { list: async () => [], search: async () => [] } as any,
    gitHubInstaller: { install: async () => {} } as any,
    skillSearch: { search: async () => [] } as any,
    changelog: { add: async () => {}, list: async () => [] } as any,
    tasksCompleted: 0,
    terminalAllowed: false,
    headless: true,
    sandboxMode: "off",
    activeRecording: null,
  };
}

describe("WS RPC endpoint", () => {
  test("responds to system.status", async () => {
    const deps = makeMockRpcDeps();
    const app = new Hono();
    const wsApp = createWSApp({ rpcDeps: deps, memory: {} as any } as any, upgradeWebSocket);
    app.route("/", wsApp);

    const server = Bun.serve({ port: 0, fetch: app.fetch, websocket });

    const response = await new Promise<string[]>((resolve, reject) => {
      const messages: string[] = [];
      const ws = new WebSocket(`ws://localhost:${server.port}/ws/rpc`);
      ws.onopen = () => {
        ws.send(JSON.stringify({ jsonrpc: "2.0", method: "system.status", id: 1 }));
      };
      ws.onmessage = (ev) => {
        messages.push(ev.data as string);
        if (messages.length >= 1) {
          setTimeout(() => { ws.close(); server.stop(); resolve(messages); }, 200);
        }
      };
      ws.onerror = (ev) => reject(new Error("WS error"));
      setTimeout(() => reject(new Error("timeout")), 5000);
    });

    expect(response.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(response[0]);
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(1);
    expect(parsed.result.running).toBe(true);
  });

  test("returns error for unknown method", async () => {
    const deps = makeMockRpcDeps();
    const app = new Hono();
    const wsApp = createWSApp({ rpcDeps: deps, memory: {} as any } as any, upgradeWebSocket);
    app.route("/", wsApp);

    const server = Bun.serve({ port: 0, fetch: app.fetch, websocket });

    const response = await new Promise<string[]>((resolve, reject) => {
      const messages: string[] = [];
      const ws = new WebSocket(`ws://localhost:${server.port}/ws/rpc`);
      ws.onopen = () => {
        ws.send(JSON.stringify({ jsonrpc: "2.0", method: "nonexistent.method", id: 99 }));
      };
      ws.onmessage = (ev) => {
        messages.push(ev.data as string);
        setTimeout(() => { ws.close(); server.stop(); resolve(messages); }, 200);
      };
      ws.onerror = (ev) => reject(new Error("WS error"));
      setTimeout(() => reject(new Error("timeout")), 5000);
    });

    const parsed = JSON.parse(response[0]);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe(-32601);
  });

  test("handles parse error", async () => {
    const deps = makeMockRpcDeps();
    const app = new Hono();
    const wsApp = createWSApp({ rpcDeps: deps, memory: {} as any } as any, upgradeWebSocket);
    app.route("/", wsApp);

    const server = Bun.serve({ port: 0, fetch: app.fetch, websocket });

    const response = await new Promise<string[]>((resolve, reject) => {
      const messages: string[] = [];
      const ws = new WebSocket(`ws://localhost:${server.port}/ws/rpc`);
      ws.onopen = () => {
        ws.send("not json at all");
      };
      ws.onmessage = (ev) => {
        messages.push(ev.data as string);
        setTimeout(() => { ws.close(); server.stop(); resolve(messages); }, 200);
      };
      ws.onerror = (ev) => reject(new Error("WS error"));
      setTimeout(() => reject(new Error("timeout")), 5000);
    });

    const parsed = JSON.parse(response[0]);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe(-32700);
  });
});
