import { test, describe, expect, mock } from "bun:test";
import { StreamingHandler } from "../../../src/agent/loop-modules/streaming-handler";

describe("StreamingHandler", () => {
  test("onToken invokes registered callbacks", () => {
    const handler = new StreamingHandler();
    (handler as any).tokenCallbacks.push = (cb: any) => {
      (handler as any).tokenCallbacks = [cb];
    };
    const cb = mock((_token: string) => {});
    (handler as any).tokenCallbacks = [cb];
    handler.onToken("hello");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("hello");
  });

  test("onStep invokes registered callbacks", () => {
    const handler = new StreamingHandler();
    const cb = mock((_action: string, _detail: string) => {});
    (handler as any).stepCallbacks = [cb];
    handler.onStep("navigate", "https://example.com");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("navigate", "https://example.com");
  });

  test("onProgress invokes registered callbacks", () => {
    const handler = new StreamingHandler();
    const cb = mock((_phase: string, _data?: Record<string, unknown>) => {});
    (handler as any).progressCallbacks = [cb];
    handler.onProgress("thinking", { step: 1 });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("thinking", { step: 1 });
  });

  test("onProgress works without data", () => {
    const handler = new StreamingHandler();
    const cb = mock((_phase: string, _data?: Record<string, unknown>) => {});
    (handler as any).progressCallbacks = [cb];
    handler.onProgress("done");
    expect(cb).toHaveBeenCalledWith("done", undefined);
  });

  test("multiple callbacks all get called", () => {
    const handler = new StreamingHandler();
    const cb1 = mock(() => {});
    const cb2 = mock(() => {});
    (handler as any).tokenCallbacks = [cb1, cb2];
    handler.onToken("x");
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});
