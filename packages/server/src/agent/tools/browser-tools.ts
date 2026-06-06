/**
 * Browser Tools Registration
 * Registers Playwright-based browser tools with the agent ToolBus
 */

import { ToolBus } from './bus.js';
import type { ToolExecutor } from './interfaces.js';
import { BrowserController } from '../../browser/controller.js';
import type { ToolDefinition } from '../../core/types.js';
import type { ProjectManager } from '../../project/manager.js';

let browserController: BrowserController | null = null;
let projectManager: ProjectManager | null = null;

export function setProjectManager(pm: ProjectManager): void {
  projectManager = pm;
}

export function registerBrowserTools(toolBus: ToolBus, controller?: BrowserController): void {
  if (!browserController && controller) {
    browserController = controller;
  }

  if (!browserController) {
    throw new Error('BrowserController not provided. Pass it to registerBrowserTools().');
  }

  // Define browser tools
  const tools: ToolDefinition[] = [
    {
      name: 'browser_navigate',
      description: 'Navigate the browser to a URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'browser_click',
      description: 'Click an element on the page by its refId',
      parameters: {
        type: 'object',
        properties: {
          refId: {
            type: 'number',
            description: 'The refId of the element to click',
          },
        },
        required: ['refId'],
      },
    },
    {
      name: 'browser_type',
      description: 'Type text into an element, optionally submitting the form',
      parameters: {
        type: 'object',
        properties: {
          refId: {
            type: 'number',
            description: 'The refId of the input element',
          },
          text: { type: 'string', description: 'The text to type' },
          submit: {
            type: 'boolean',
            description: 'Press Enter after typing to submit',
          },
        },
        required: ['refId', 'text'],
      },
    },
    {
      name: 'browser_snapshot',
      description: 'Take a snapshot of the current page, returning visible interactive elements with refIds',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_extract_text',
      description: 'Extract all visible text content from the current page',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current page and return base64 PNG',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  ];

  // Create tool executor
  const executor: ToolExecutor = async (name, args) => {
    const currentController = browserController;
    if (!currentController) {
      return {
        success: false,
        output: '',
        error: 'BrowserController not initialized',
      };
    }

    try {
      let result: string;

      switch (name) {
        case 'browser_navigate':
          result = await currentController.navigate(args.url as string);
          break;
        case 'browser_click':
          result = await currentController.click(args.refId as number);
          break;
        case 'browser_type':
          result = await currentController.typeText(
            args.refId as number,
            args.text as string,
            args.submit as boolean
          );
          break;
        case 'browser_snapshot':
          const snapshot = await currentController.snapshot();
          result = JSON.stringify({
            url: snapshot.url,
            title: snapshot.title,
            elements: snapshot.elements.slice(0, 20),
            elementCount: snapshot.elements.length,
          });
          break;
        case 'browser_extract_text':
          result = await currentController.extractText();
          break;
        case 'browser_screenshot':
          const screenshot = await currentController.screenshot();
          result = screenshot ? `Screenshot taken (${screenshot.length} bytes)` : 'Screenshot failed';
          break;
        default:
          return {
            success: false,
            output: '',
            error: `Unknown tool: ${name}`,
          };
      }

      return {
        success: true,
        output: result,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  // Register all browser tools
  for (const tool of tools) {
    toolBus.register(tool, executor);
  }
}

export function registerBrowserToolsForProject(
  toolBus: ToolBus,
  projectManager: ProjectManager,
  projectId: string
): void {
  const controller = projectManager.getBrowserController(projectId);
  if (!controller) {
    throw new Error(`Browser not started for project: ${projectId}`);
  }
  registerBrowserTools(toolBus, controller);
}

export function getBrowserController(projectId?: string): BrowserController | null {
  if (projectId && projectManager) {
    return projectManager.getBrowserController(projectId);
  }
  return browserController;
}

export function setBrowserController(controller: BrowserController): void {
  browserController = controller;
}

export async function cleanupBrowserTools(): Promise<void> {
  if (browserController) {
    await browserController.stop();
    browserController = null;
  }
  if (projectManager) {
    await projectManager.shutdown();
    projectManager = null;
  }
}

/**
 * Take a screenshot from the active browser
 */
export async function takeBrowserScreenshot(projectId?: string): Promise<string | null> {
  const controller = getBrowserController(projectId);
  if (!controller) return null;
  return controller.screenshot();
}
