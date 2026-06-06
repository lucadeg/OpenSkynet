import { test, describe, expect, beforeEach } from "bun:test";
import { BaseAdapter, type SendResult } from "../../src/gateway/base";
import { GatewayRunner } from "../../src/gateway/runner";

class MockAdapter extends BaseAdapter {
  get platform() { return "mock"; }
  started = false;
  stopped = false;
  sent: Array<{ target: string; content: string }> = [];

  async start() { this.started = true; }
  async stop() { this.stopped = true; }
  async send(target: string, content: string): Promise<SendResult> {
    this.sent.push({ target, content });
    return { success: true, messageId: "msg-1" };
  }
  isConnected() { return this.started && !this.stopped; }
}

describe("GatewayRunner", () => {
  let runner: GatewayRunner;

  beforeEach(() => {
    runner = new GatewayRunner();
  });

  test("registerAdapter adds adapter", () => {
    const adapter = new MockAdapter();
    runner.registerAdapter(adapter);
    expect(adapter).toBeDefined();
  });

  test("unregisterAdapter removes adapter", () => {
    const adapter = new MockAdapter();
    runner.registerAdapter(adapter);
    runner.unregisterAdapter("mock");
  });

  test("setAgentRunner sets the runner function", () => {
    const fn = async (task: string) => `result: ${task}`;
    runner.setAgentRunner(fn);
  });

  test("starts all adapters", async () => {
    const adapter = new MockAdapter();
    runner.registerAdapter(adapter);
    await runner.start();
    expect(adapter.started).toBe(true);
    await runner.stop();
  });

  test("stops all adapters", async () => {
    const adapter = new MockAdapter();
    runner.registerAdapter(adapter);
    await runner.start();
    await runner.stop();
    expect(adapter.stopped).toBe(true);
  });

  test("deliverToHome sends via adapter", async () => {
    const adapter = new MockAdapter();
    runner.registerAdapter(adapter);
    runner.setHomeChannel("home-channel");
    await runner.deliverToHome("hello home");
    expect(adapter.sent.length).toBe(1);
    expect(adapter.sent[0].target).toBe("home-channel");
    expect(adapter.sent[0].content).toBe("hello home");
  });
});
