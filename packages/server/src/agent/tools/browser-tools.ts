/**
 * Browser Tools Registration
 * Registers Playwright-based browser tools with the agent ToolBus
 */

import { ToolBus } from './bus.js';
import type { ToolExecutor } from './interfaces.js';
import { BrowserController } from '../../browser/controller.js';
import type { ToolDefinition } from '../../core/types.js';
import type { ProjectManager } from '../../project/manager.js';
import { setLatestScreenshot } from '../../api/routes/browser.js';

let browserController: BrowserController | null = null;
let projectManager: ProjectManager | null = null;

// Human intervention system — agent can request help from user
let pendingInterventionId = 0;
let interventionPromise: { resolve: (v: string) => void; message: string; id: number } | null = null;

export function hasPendingIntervention(): boolean {
  return interventionPromise !== null;
}

export function getPendingIntervention(): { message: string; id: number } | null {
  if (!interventionPromise) return null;
  return { message: interventionPromise.message, id: interventionPromise.id };
}

export function resolveIntervention(result: string): boolean {
  if (!interventionPromise) return false;
  interventionPromise.resolve(result);
  interventionPromise = null;
  console.log('[BrowserTools] Intervention resolved:', result);
  return true;
}

export function setProjectManager(pm: ProjectManager): void {
  projectManager = pm;
}

/**
 * Capture and store a screenshot for the frontend, fire-and-forget.
 * Never throws — suppresses all errors silently.
 */
function captureAndStoreScreenshot(url?: string): void {
  const ctrl = browserController;
  if (!ctrl) return;

  // Fire-and-forget: don't block tool execution on screenshot capture
  (async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const screenshot = await ctrl.screenshot();
      if (screenshot && screenshot.length > 100) {
        const currentUrl = url || ctrl.getSession()?.context?.pages()[0]?.url() || 'Unknown';
        setLatestScreenshot(screenshot, currentUrl);
        console.log('[BrowserTools] Screenshot stored for client:', currentUrl);
      }
    } catch (e) {
      // Silently ignore screenshot failures
    }
  })();
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
    {
      name: 'browser_take_and_store_screenshot',
      description: 'Take a screenshot and store it for UI display (use this after any operation to update the view)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_end',
      description: 'Call this tool when you have completed the task and are ready to report results. This signals that you are done and should stop.',
      parameters: { type: 'object', properties: {
        summary: {
          type: 'string',
          description: 'Brief summary of what was accomplished'
        }
      }, required: [] },
    },
    {
      name: 'request_human_help',
      description: 'Request human help for tasks the agent cannot complete alone (CAPTCHA solving, login, payment, SMS verification, etc). The user will be shown a prompt and the agent will wait until the user clicks Done. Provide a clear message describing what the user needs to do.',
      parameters: { type: 'object', properties: {
        message: {
          type: 'string',
          description: 'What the user should do (e.g. "Please solve the reCAPTCHA on the page", "Please log in with your credentials")'
        }
      }, required: ['message'] },
    },
  ];

  // Create tool executor
  const executor: ToolExecutor = async (name, args) => {
    const currentController = browserController;
    if (!currentController) {
      console.log('[BrowserTools] BrowserController not initialized');
      return {
        success: false,
        output: '',
        error: 'BrowserController not initialized',
      };
    }

    try {
      let result: string;

      // Ensure browser is started before any operation
      const session = currentController.getSession();
      console.log('[BrowserTools] Session:', session ? 'exists' : 'null', 'isStarted:', session?.isStarted);

      // Check if session exists and is started
      if (!session || !session.isStarted) {
        console.log('[BrowserTools] Starting browser session...');
        await currentController.start();
        console.log('[BrowserTools] Browser session started');
      } else {
        console.log('[BrowserTools] Browser session already started');
      }

      // Ensure we have an active page
      const sessionContext = session?.context;
      console.log('[BrowserTools] Context:', sessionContext ? 'exists' : 'null');

      if (sessionContext) {
        const pages = sessionContext.pages();
        console.log('[BrowserTools] Pages count:', pages.length);

        if (pages.length === 0) {
          console.log('[BrowserTools] Creating new page...');
          const page = await sessionContext.newPage();
          console.log('[BrowserTools] New page created, URL:', page.url());
        }
      } else {
        console.log('[BrowserTools] No context available');
        return {
          success: false,
          output: '',
          error: 'Browser context not available',
        };
      }

      console.log('[BrowserTools] Executing tool:', name, 'with args:', args);

      switch (name) {
        case 'browser_navigate':
          result = await currentController.navigate(args.url as string);
          console.log('[BrowserTools] Navigation result:', result);
          captureAndStoreScreenshot(args.url as string);
          break;
        case 'browser_click':
          result = await currentController.click(args.refId as number);
          console.log('[BrowserTools] Click result:', result);
          captureAndStoreScreenshot();
          break;
        case 'browser_type':
          result = await currentController.typeText(
            args.refId as number,
            args.text as string,
            args.submit as boolean
          );
          console.log('[BrowserTools] Type result:', result);
          captureAndStoreScreenshot();
          break;
        case 'browser_snapshot':
          const snapshot = await currentController.snapshot();
          const output = snapshot.output || snapshot.elements.map(
            (el, i) => `[${el.refId}]<${el.tag}>${el.text ? ' ' + JSON.stringify(el.text.slice(0, 100)) : ''}`
          ).join('\\n');
          result = `Current URL: ${snapshot.url}\\nTitle: ${snapshot.title}\\n\\n${output}\n\\n${snapshot.elements.length} interactive elements total.`;
          console.log('[BrowserTools] Snapshot:', snapshot.elements.length, 'elements');
          captureAndStoreScreenshot(snapshot.url);
          break;
        case 'browser_extract_text':
          result = await currentController.extractText();
          console.log('[BrowserTools] Extract text result:', result.substring(0, 100) + '...');
          break;
        case 'browser_screenshot':
          const screenshot = await currentController.screenshot();
          result = screenshot ? `Screenshot taken (${screenshot.length} bytes)` : 'Screenshot failed';
          console.log('[BrowserTools] Screenshot result:', result);
          if (screenshot && screenshot.length > 100) {
            setLatestScreenshot(screenshot, currentController.getSession()?.context?.pages()[0]?.url() || 'Unknown');
            console.log('[BrowserTools] Screenshot stored for client');
          }
          break;
        case 'browser_take_and_store_screenshot':
          const manualScreenshot = await currentController.screenshot();
          if (manualScreenshot && manualScreenshot.length > 100) {
            const currentUrl = currentController.getSession()?.context?.pages()[0]?.url() || 'Unknown';
            setLatestScreenshot(manualScreenshot, currentUrl);
            result = `Screenshot captured and stored for display (${manualScreenshot.length} bytes)`;
            console.log('[BrowserTools] Manual screenshot stored:', currentUrl);
          } else {
            result = 'Failed to capture screenshot';
            console.log('[BrowserTools] Manual screenshot failed');
          }
          break;
        case 'browser_end':
          const summary = args.summary || 'Task completed';
          result = `Task completed: ${summary}`;
          console.log('[BrowserTools] Browser end called with summary:', summary);
          break;
        case 'request_human_help':
          const helpMessage = (args.message as string) || 'Agent needs your assistance';
          console.log('[BrowserTools] Human help requested:', helpMessage);
          
          // Take a screenshot so the user can see the current state
          try {
            const helpShot = await currentController.screenshot();
            if (helpShot) {
              setLatestScreenshot(helpShot, currentController.getSession()?.context?.pages()[0]?.url() || 'Unknown');
            }
          } catch {}
          
          // Block until user clicks "Done" (or 2-minute timeout)
          const interventionId = ++pendingInterventionId;
          try {
            const userResponse = await new Promise<string>((resolve) => {
              interventionPromise = { resolve, message: helpMessage, id: interventionId };
              // Timeout after 2 minutes
              setTimeout(() => {
                if (interventionPromise?.id === interventionId) {
                  resolve('timeout');
                }
              }, 120000);
            });
            
            if (userResponse === 'timeout') {
              result = 'Human intervention timed out after 2 minutes. The user did not respond.';
            } else {
              result = `Human intervention completed: ${userResponse}`;
            }
          } catch {
            result = 'Human intervention cancelled';
          }
          interventionPromise = null;
          break;
        default:
          console.log('[BrowserTools] Unknown tool:', name);
          return {
            success: false,
            output: '',
            error: `Unknown tool: ${name}`,
          };
      }

      console.log('[BrowserTools] Tool execution successful, result:', result.substring(0, 100) + '...');

      return {
        success: true,
        output: result,
      };
    } catch (error) {
      console.log('[BrowserTools] Tool execution error:', error);
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
