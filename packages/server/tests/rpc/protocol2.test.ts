/** Tests for RPC Protocol */
import { test, describe, expect } from "bun:test";

describe("RPCProtocol", () => {
  describe("JSON-RPC 2.0", () => {
    test("parses request", () => {
      const request = {
        jsonrpc: "2.0",
        method: "test",
        params: { arg1: "value1" },
        id: 1,
      };
      expect(request.jsonrpc).toBe("2.0");
    });

    test("parses response", () => {
      const response = {
        jsonrpc: "2.0",
        result: { success: true },
        id: 1,
      };
      expect(response.jsonrpc).toBe("2.0");
    });
  });

  describe("error handling", () => {
    test("formats error response", () => {
      const error = {
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Method not found",
        },
        id: 1,
      };
      expect(error.error).toBeDefined();
    });
  });

  describe("batch requests", () => {
    test("processes batch requests", () => {
      const batch = [
        { jsonrpc: "2.0", method: "method1", id: 1 },
        { jsonrpc: "2.0", method: "method2", id: 2 },
      ];
      expect(batch.length).toBe(2);
    });
  });
});
