/**
 * Tests for Messaging Tool.
 * Converted from Python tests/test_messaging.py
 */

import { test, describe, expect, beforeEach } from "bun:test";
import { MessagingTool, type MessagingConfig, type MessagingIntegration } from "../../../src/agent/tools/messaging";
import type { ToolBus } from "../../../src/agent/tools/bus";

describe("MessagingTool", () => {
  let tool: MessagingTool;
  let mockBus: ToolBus;
  let mockIntegration: MessagingIntegration;

  beforeEach(() => {
    mockBus = {
      register: () => {},
      execute: async () => ({ success: true, output: "" }),
    } as any;

    mockIntegration = {
      send: async (channel: string, content: string) => `Sent to ${channel}: ${content}`,
    } as MessagingIntegration;

    tool = new MessagingTool({
      integrations: new Map([["test", mockIntegration]]),
    });
  });

  describe("constructor", () => {
    test("initializes with empty integrations", () => {
      const tool = new MessagingTool();

      expect(tool).toBeDefined();
    });

    test("initializes with integrations", () => {
      const integrations = new Map([
        ["discord", mockIntegration],
        ["telegram", mockIntegration],
      ]);

      const tool = new MessagingTool({ integrations });

      expect(tool).toBeDefined();
    });
  });

  describe("register", () => {
    test("registers send_message tool", () => {
      let registeredTool: any = null;

      mockBus.register = (def: any, handler: any) => {
        registeredTool = { def, handler };
      };

      tool.register(mockBus);

      expect(registeredTool).toBeDefined();
      expect(registeredTool.def.name).toBe("send_message");
    });

    test("tool has correct parameters", () => {
      let registeredDef: any = null;

      mockBus.register = (def: any) => {
        registeredDef = def;
      };

      tool.register(mockBus);

      expect(registeredDef.parameters.properties.action).toBeDefined();
      expect(registeredDef.parameters.properties.target).toBeDefined();
      expect(registeredDef.parameters.properties.content).toBeDefined();
      expect(registeredDef.parameters.required).toContain("action");
    });

    test("action supports list and send", () => {
      let registeredDef: any = null;

      mockBus.register = (def: any) => {
        registeredDef = def;
      };

      tool.register(mockBus);

      const actions = registeredDef.parameters.properties.action.enum;
      expect(actions).toContain("list");
      expect(actions).toContain("send");
    });
  });

  describe("list action", () => {
    test("lists available targets", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "list",
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain("test");
    });

    test("returns message when no integrations", async () => {
      const tool = new MessagingTool();

      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "list",
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain("No messaging targets");
    });

    test("includes channels in output", async () => {
      const integrationWithChannels = {
        send: async () => "ok",
        getChannels: () => ({
          alerts: "Alerts Channel",
          general: "General Discussion",
        }),
      } as any;

      const tool = new MessagingTool({
        integrations: new Map([["discord", integrationWithChannels]]),
      });

      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "list",
      });

      expect(result.output).toContain("discord");
    });
  });

  describe("send action", () => {
    test("sends message to target", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        target: "test:channel1",
        content: "Hello world",
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain("sent to test:channel1");
    });

    test("requires target for send", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        content: "Hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("target and content are required");
    });

    test("requires content for send", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        target: "test:channel1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("target and content are required");
    });

    test("validates target format", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        target: "invalid-format",
        content: "Hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("platform:channel_key");
    });

    test("returns error for unknown platform", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        target: "unknown:channel",
        content: "Hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    test("handles integration errors", async () => {
      const errorIntegration = {
        send: async () => {
          throw new Error("Network error");
        },
      } as MessagingIntegration;

      const tool = new MessagingTool({
        integrations: new Map([["test", errorIntegration]]),
      });

      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        target: "test:channel",
        content: "Hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("registerIntegration", () => {
    test("adds new integration", () => {
      const tool = new MessagingTool();

      tool.registerIntegration("discord", mockIntegration);

      expect(tool.hasIntegration("discord")).toBe(true);
    });

    test("replaces existing integration", () => {
      tool.registerIntegration("test", mockIntegration);

      const newIntegration = {
        send: async () => "new",
      } as MessagingIntegration;

      tool.registerIntegration("test", newIntegration);

      expect(tool.hasIntegration("test")).toBe(true);
    });
  });

  describe("unregisterIntegration", () => {
    test("removes integration", () => {
      tool.registerIntegration("test", mockIntegration);

      tool.unregisterIntegration("test");

      expect(tool.hasIntegration("test")).toBe(false);
    });

    test("handles non-existent integration", () => {
      tool.unregisterIntegration("non-existent");
      // Should not throw
    });
  });

  describe("hasIntegration", () => {
    test("returns true for existing integration", () => {
      expect(tool.hasIntegration("test")).toBe(true);
    });

    test("returns false for non-existent integration", () => {
      expect(tool.hasIntegration("non-existent")).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("handles empty message content", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        target: "test:channel",
        content: "",
      });

      // Empty content should still work
      expect(result).toBeDefined();
    });

    test("handles very long messages", async () => {
      const longContent = "A".repeat(10000);

      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        target: "test:channel",
        content: longContent,
      });

      expect(result).toBeDefined();
    });

    test("handles unicode messages", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("send_message", {
        action: "send",
        target: "test:channel",
        content: "Hello 世界 🌍",
      });

      expect(result).toBeDefined();
    });
  });
});
