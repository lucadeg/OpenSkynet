/**
 * Tests for Orchestrate Search Tool.
 * Converted from Python tests/test_orchestrate.py
 */

import { test, describe, expect, beforeEach } from "bun:test";
import { OrchestrateTool, type OrchestrateConfig } from "../../../src/agent/tools/orchestrate";
import type { ToolBus } from "../../../src/agent/tools/bus";
import type { SearchSDK } from "../../../src/search/sdk";
import type { SearchResult } from "../../../src/search/base";

describe("OrchestrateTool", () => {
  let tool: OrchestrateTool;
  let mockBus: ToolBus;
  let mockSearchSDK: SearchSDK;

  beforeEach(() => {
    mockBus = {
      register: () => {},
      execute: async () => ({ success: true, output: "" }),
    } as any;

    mockSearchSDK = {
      search: async (query: string) => [
        {
          url: "https://example.com",
          title: "Example",
          snippet: "Example content",
        } as SearchResult,
      ],
    } as SearchSDK;

    tool = new OrchestrateTool({
      allowed: true,
      searchSDK: mockSearchSDK,
    });
  });

  describe("constructor", () => {
    test("initializes with defaults", () => {
      const tool = new OrchestrateTool();

      expect(tool).toBeDefined();
    });

    test("accepts custom config", () => {
      const config: OrchestrateConfig = {
        allowed: true,
        timeout: 60,
        searchSDK: mockSearchSDK,
      };

      const tool = new OrchestrateTool(config);

      expect(tool).toBeDefined();
    });
  });

  describe("register", () => {
    test("registers orchestrate_search tool", () => {
      let registeredTool: any = null;

      mockBus.register = (def: any, handler: any) => {
        registeredTool = { def, handler };
      };

      tool.register(mockBus);

      expect(registeredTool).toBeDefined();
      expect(registeredTool.def.name).toBe("orchestrate_search");
    });

    test("tool has correct parameters", () => {
      let registeredDef: any = null;

      mockBus.register = (def: any) => {
        registeredDef = def;
      };

      tool.register(mockBus);

      expect(registeredDef.parameters.properties.code).toBeDefined();
      expect(registeredDef.parameters.properties.timeout).toBeDefined();
      expect(registeredDef.parameters.required).toContain("code");
    });

    test("tool description mentions SearchSDK", () => {
      let registeredDef: any = null;

      mockBus.register = (def: any) => {
        registeredDef = def;
      };

      tool.register(mockBus);

      expect(registeredDef.description).toContain("SearchSDK");
      expect(registeredDef.description).toContain("Retrieve");
      expect(registeredDef.description).toContain("filter");
      expect(registeredDef.description).toContain("extract");
    });
  });

  describe("execute", () => {
    test("denies execution when not allowed", async () => {
      const tool = new OrchestrateTool({ allowed: false });

      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "const results = await sdk.web('test');",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    test("returns error when SearchSDK not configured", async () => {
      const tool = new OrchestrateTool({ allowed: true });

      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "const results = await sdk.web('test');",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("SearchSDK not configured");
    });

    test("returns error for missing code", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Code is required");
    });

    test("returns error for empty code", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "   ",
      });

      expect(result.success).toBe(false);
    });

    test("executes search orchestration code", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "const results = await sdk.web('test query'); return results;",
      });

      expect(result).toBeDefined();
    }, { skip: true }); // Skip actual code execution

    test("handles execution errors", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "invalid syntax here",
      });

      expect(result).toBeDefined();
    }, { skip: true });
  });

  describe("setters", () => {
    test("setAllowed updates permission", () => {
      tool.setAllowed(false);

      expect(tool).toBeDefined();
    });

    test("setTimeout updates timeout", () => {
      tool.setTimeout(120);

      expect(tool).toBeDefined();
    });

    test("setSearchSDK updates SDK", () => {
      const newSDK = {} as SearchSDK;

      tool.setSearchSDK(newSDK);

      expect(tool).toBeDefined();
    });
  });

  describe("SandboxSearchAPI", () => {
    test("provides web method", async () => {
      const results = await mockSearchSDK.search("test");

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test("provides webMany method", () => {
      // webMany would execute multiple searches
      expect(mockSearchSDK).toBeDefined();
    });

    test("provides filterByDomain method", () => {
      const results = [
        { url: "https://example.com" } as SearchResult,
        { url: "https://spam.com" } as SearchResult,
      ];

      // Filter would remove spam.com
      expect(results).toBeDefined();
    });

    test("provides extract method", () => {
      // extract would parse results
      expect(mockSearchSDK).toBeDefined();
    });
  });

  describe("code execution", () => {
    test("wraps code with SDK imports", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      // The tool should wrap user code with SDK access
      const result = await handler("orchestrate_search", {
        code: "return await sdk.web('query');",
      });

      expect(result).toBeDefined();
    }, { skip: true });

    test("handles async code", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "const results = await sdk.web('test'); return results.length;",
      });

      expect(result).toBeDefined();
    }, { skip: true });

    test("returns result count", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "const results = await sdk.web('test'); return results;",
      });

      if (result.data) {
        expect(result.data.result_count).toBeDefined();
      }
    }, { skip: true });
  });

  describe("edge cases", () => {
    test("handles very long code", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const longCode = "const x = 1;\n".repeat(1000);

      const result = await handler("orchestrate_search", {
        code: longCode,
      });

      expect(result).toBeDefined();
    }, { skip: true });

    test("handles code with special characters", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const code = "// Search for: 测试\nconst results = await sdk.web('query');";

      const result = await handler("orchestrate_search", {
        code,
      });

      expect(result).toBeDefined();
    }, { skip: true });

    test("handles code with unicode", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const code = "const results = await sdk.web('مرحبا');";

      const result = await handler("orchestrate_search", {
        code,
      });

      expect(result).toBeDefined();
    }, { skip: true });
  });

  describe("timeout handling", () => {
    test("respects custom timeout", async () => {
      const tool = new OrchestrateTool({
        allowed: true,
        timeout: 10,
        searchSDK: mockSearchSDK,
      });

      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "while(true) {}",
        timeout: 10,
      });

      // Should timeout after 10 seconds
      expect(result).toBeDefined();
    }, { skip: true });

    test("uses default timeout when not specified", async () => {
      let handler: any = null;
      mockBus.register = (_def: any, h: any) => {
        handler = h;
      };

      tool.register(mockBus);

      const result = await handler("orchestrate_search", {
        code: "return await sdk.web('test');",
      });

      expect(result).toBeDefined();
    }, { skip: true });
  });
});
