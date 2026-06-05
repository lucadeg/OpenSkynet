import type { ToolDefinition } from "../core/types";
import type { BrowserController } from "./controller";

export function registerBrowserTools(
  controller: BrowserController,
): ToolDefinition[] {
  return [
    {
      name: "browser_navigate",
      description: "Navigate the browser to a URL",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to navigate to",
          },
        },
        required: ["url"],
      },
      toolset: "browser",
    },
    {
      name: "browser_snapshot",
      description:
        "Take a snapshot of the current page, returning visible interactive elements with refIds",
      parameters: { type: "object", properties: {}, required: [] },
      toolset: "browser",
    },
    {
      name: "browser_click",
      description: "Click an element on the page by its refId",
      parameters: {
        type: "object",
        properties: {
          refId: {
            type: "number",
            description: "The refId of the element to click",
          },
        },
        required: ["refId"],
      },
      toolset: "browser",
    },
    {
      name: "browser_type",
      description: "Type text into an element, optionally submitting the form",
      parameters: {
        type: "object",
        properties: {
          refId: {
            type: "number",
            description: "The refId of the input element",
          },
          text: { type: "string", description: "The text to type" },
          submit: {
            type: "boolean",
            description: "Press Enter after typing to submit",
          },
        },
        required: ["refId", "text"],
      },
      toolset: "browser",
    },
    {
      name: "browser_hover",
      description: "Hover over an element by its refId",
      parameters: {
        type: "object",
        properties: {
          refId: {
            type: "number",
            description: "The refId of the element to hover over",
          },
        },
        required: ["refId"],
      },
      toolset: "browser",
    },
    {
      name: "browser_select_option",
      description: "Select an option in a dropdown element by refId",
      parameters: {
        type: "object",
        properties: {
          refId: {
            type: "number",
            description: "The refId of the select element",
          },
          value: {
            type: "string",
            description: "The value of the option to select",
          },
        },
        required: ["refId", "value"],
      },
      toolset: "browser",
    },
    {
      name: "browser_scroll",
      description:
        "Scroll the page in a direction (up, down, left, right) by a pixel amount",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["up", "down", "left", "right"],
            description: "Direction to scroll",
          },
          amount: {
            type: "number",
            description: "Pixels to scroll (default 500)",
          },
        },
        required: ["direction"],
      },
      toolset: "browser",
    },
    {
      name: "browser_press_key",
      description: "Press a keyboard key (e.g. Enter, Tab, Escape, ArrowDown)",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description:
              "The key to press (e.g. Enter, Tab, Escape, ArrowDown, a, b, etc.)",
          },
        },
        required: ["key"],
      },
      toolset: "browser",
    },
    {
      name: "browser_go_back",
      description: "Navigate to the previous page in history",
      parameters: { type: "object", properties: {}, required: [] },
      toolset: "browser",
    },
    {
      name: "browser_go_forward",
      description: "Navigate to the next page in history",
      parameters: { type: "object", properties: {}, required: [] },
      toolset: "browser",
    },
    {
      name: "browser_refresh",
      description: "Refresh the current page",
      parameters: { type: "object", properties: {}, required: [] },
      toolset: "browser",
    },
    {
      name: "browser_switch_tab",
      description: "Switch to a browser tab by its index",
      parameters: {
        type: "object",
        properties: {
          index: {
            type: "number",
            description: "Zero-based tab index",
          },
        },
        required: ["index"],
      },
      toolset: "browser",
    },
    {
      name: "browser_list_tabs",
      description: "List all open browser tabs with their URLs and titles",
      parameters: { type: "object", properties: {}, required: [] },
      toolset: "browser",
    },
    {
      name: "browser_extract_text",
      description: "Extract all visible text content from the current page",
      parameters: { type: "object", properties: {}, required: [] },
      toolset: "browser",
    },
    {
      name: "browser_extract_selector",
      description: "Extract text content from elements matching a CSS selector",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector to match elements",
          },
        },
        required: ["selector"],
      },
      toolset: "browser",
    },
    {
      name: "browser_wait_for_selector",
      description: "Wait for an element matching a CSS selector to appear",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector to wait for",
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default 10000)",
          },
        },
        required: ["selector"],
      },
      toolset: "browser",
    },
    {
      name: "browser_screenshot",
      description: "Take a screenshot of the current page and return base64 PNG",
      parameters: { type: "object", properties: {}, required: [] },
      toolset: "browser",
    },
    {
      name: "browser_save_checkpoint",
      description:
        "Save the current page URL and scroll position as a checkpoint",
      parameters: { type: "object", properties: {}, required: [] },
      toolset: "browser",
    },
    {
      name: "browser_restore_checkpoint",
      description:
        "Restore the browser to a previously saved checkpoint (defaults to last checkpoint)",
      parameters: {
        type: "object",
        properties: {
          index: {
            type: "number",
            description:
              "Checkpoint index to restore (defaults to last saved)",
          },
        },
        required: [],
      },
      toolset: "browser",
    },
  ];
}
