import { Hono } from "hono";
import type { BrowserSession } from "../../browser/session";
import { getBrowserController, hasPendingIntervention, getPendingIntervention, resolveIntervention } from "../../agent/tools/browser-tools";
import { createLogger } from "../../core/logging";

const logger = createLogger("browser-api");

// Store the latest screenshot globally (in production, this would be in a proper state manager)
let latestScreenshot: { data: string | { elements: any[] }; url: string; timestamp: number } | null = null;

// CDP connection state for shared browser
let cdpConnected = false;
let cdpResolver: ((value: boolean) => void) | null = null;
let cdpRejecter: ((reason: string) => void) | null = null;

export function setLatestScreenshot(data: string | { elements: any[] }, url: string) {
  latestScreenshot = { data, url, timestamp: Date.now() };
}

/**
 * Wait for CDP connection to be established (for shared browser mode)
 * Returns true if connected, false if timeout
 */
export function waitForCdpConnection(timeout = 10000): Promise<boolean> {
  if (cdpConnected) {
    logger.info("CDP already connected, proceeding");
    return Promise.resolve(true);
  }

  logger.info(`Waiting for CDP connection (timeout: ${timeout}ms)...`);

  return new Promise((resolve, reject) => {
    cdpResolver = resolve;
    cdpRejecter = reject;

    const timeoutId = setTimeout(() => {
      if (cdpResolver) {
        logger.warn("CDP connection timeout");
        cdpResolver = null;
        cdpRejecter = null;
        resolve(false); // Timeout - not connected
      }
    }, timeout);

    // Store timeout ID so we can clear it on success
    (waitForCdpConnection as any)._timeoutId = timeoutId;
  });
}

/**
 * Check if CDP is currently connected
 */
export function isCdpConnected(): boolean {
  return cdpConnected;
}

/**
 * Reset CDP connection state (for testing/reconnection)
 */
export function resetCdpConnection(): void {
  cdpConnected = false;
  if ((waitForCdpConnection as any)._timeoutId) {
    clearTimeout((waitForCdpConnection as any)._timeoutId);
  }
  if (cdpResolver) {
    cdpResolver(false);
    cdpResolver = null;
  }
  if (cdpRejecter) {
    cdpRejecter("CDP connection reset");
    cdpRejecter = null;
  }
}

export function getExternalCdpUrl(): string | null {
  // Return the CDP URL if connected to external browser
  // This will be set when external browser is launched
  return null; // Will be populated by launch-external endpoint
}

// Command queue for browser operations (Electron shared browser mode)
const commandQueue: Array<{
  id: string;
  command: any;
  timestamp: number;
  result?: any;
  error?: string;
  completed: boolean;
}> = [];

// Store latest snapshot for refId resolution
let latestSnapshot: { elements: Array<{ refId: number; x: number; y: number }> } | null = null;

export function createBrowserRoutes(browserSession?: BrowserSession): Hono {
  const router = new Hono();

  // IPC-based browser execution endpoint (VSCode approach)
  // This endpoint queues browser commands for the renderer to execute
  router.post("/exec", async (c) => {
    try {
      const body = await c.req.json<{
        action: 'navigate' | 'click' | 'type' | 'snapshot' | 'evaluate' | 'screenshot' | 'wait';
        url?: string;
        x?: number;
        y?: number;
        selector?: string;
        text?: string;
        script?: string;
        timeout?: number;
      }>();

      logger.info({ action: body.action, params: body }, "[BrowserExec] Command queued");

      const RUNNING_IN_ELECTRON = process.env.SEDIMAN_MODE === 'electron';

      if (!RUNNING_IN_ELECTRON) {
        return c.json({
          success: false,
          error: 'Browser exec endpoint only available in Electron mode'
        }, 400);
      }

      // Create a command ID and queue the command
      const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      commandQueue.push({
        id: commandId,
        command: body,
        timestamp: Date.now(),
        completed: false
      });

      logger.info(`[BrowserExec] Command queued: ${commandId} for action: ${body.action}`);

      // Wait for the renderer to execute the command (with timeout)
      const timeout = 30000; // 30 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const cmd = commandQueue.find(c => c.id === commandId);
        if (!cmd) break;

        if (cmd.completed) {
          if (cmd.error) {
            return c.json({ success: false, error: cmd.error });
          }
          return c.json({ success: true, result: cmd.result });
        }

        // Wait 100ms before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Timeout - command not completed
      logger.warn(`[BrowserExec] Command timeout: ${commandId}`);
      return c.json({ success: false, error: 'Command execution timeout' }, 408);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("[BrowserExec] Error: " + errorMsg);
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }, 500);
    }
  });

  // Endpoint for renderer to poll for pending commands
  router.get("/exec/poll", async (c) => {
    const RUNNING_IN_ELECTRON = process.env.SEDIMAN_MODE === 'electron';

    if (!RUNNING_IN_ELECTRON) {
      return c.json({ commands: [] });
    }

    // Get pending commands (not completed, ordered by timestamp)
    const pendingCommands = commandQueue
      .filter(cmd => !cmd.completed)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(cmd => ({
        id: cmd.id,
        action: cmd.command.action,
        params: cmd.command,
        // Include latest snapshot for refId resolution
        snapshot: latestSnapshot
      }));

    return c.json({ commands: pendingCommands });
  });

  // Endpoint for renderer to submit command results
  router.post("/exec/result", async (c) => {
    try {
      const body = await c.req.json<{
        commandId: string;
        result?: any;
        error?: string;
      }>();

      const cmd = commandQueue.find(c => c.id === body.commandId);
      if (!cmd) {
        logger.warn(`[BrowserExec] Result for unknown command: ${body.commandId}`);
        return c.json({ success: false, error: 'Unknown command ID' }, 404);
      }

      cmd.completed = true;
      cmd.result = body.result;
      cmd.error = body.error;

      // Store snapshot data if present in result
      if (body.result && body.result.elements && Array.isArray(body.result.elements)) {
        latestSnapshot = { elements: body.result.elements };
        logger.info(`[BrowserExec] Updated snapshot with ${body.result.elements.length} elements`);
      }

      // Log result safely (handle both strings and objects)
      let resultLog = '';
      if (body.result === undefined || body.result === null) {
        resultLog = '(no result)';
      } else if (typeof body.result === 'string') {
        resultLog = body.result.slice(0, 100);
      } else {
        resultLog = JSON.stringify(body.result).slice(0, 100);
      }
      logger.info(`[BrowserExec] Command ${body.commandId} completed: ${resultLog}`);

      return c.json({ success: true });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("[BrowserExec] Result error: " + errorMsg);
      return c.json({ success: false, error: errorMsg }, 500);
    }
  });

  // Test endpoint to check if CDP is accessible
  router.get("/test-cdp", async (c) => {
    try {
      const http = await import("http");
      const data = await new Promise((resolve, reject) => {
        http.get("http://127.0.0.1:9222/json/version", (res) => {
          let d = "";
          res.on("data", (chunk) => d += chunk);
          res.on("end", () => resolve(JSON.parse(d)));
          res.on("error", reject);
        }).on("error", reject);
      });
      return c.json({ success: true, cdpAvailable: true, data });
    } catch (err) {
      return c.json({
        success: false,
        cdpAvailable: false,
        error: err instanceof Error ? err.message : String(err)
      }, 500);
    }
  });

  // Prepare embedded webview for shared browser (like VSCode/Cursor)
  router.post("/prepare-shared-browser", async (c) => {
    if (!browserSession) {
      return c.json({ error: "Browser session not available" }, 500);
    }

    try {
      logger.info("browser.prepare-shared-browser: Preparing embedded webview for CDP...");

      // Create a BrowserController in advance for the webview
      const { BrowserController } = await import("../../browser/controller.js");
      const controller = new BrowserController({
        onStep: (action, detail) => {
          logger.info("[BrowserController] Step: " + action + " - " + detail);
        }
      });

      // Store the controller for later use when CDP connects
      (global as any).__browserController = controller;

      logger.info("browser.prepare-shared-browser: BrowserController created, waiting for CDP connection");

      return c.json({
        success: true,
        message: "BrowserController prepared, ready for CDP connection from webview"
      });
    } catch (err) {
      logger.error("browser.prepare-shared-browser: Failed: " + (err instanceof Error ? err.message : String(err)));
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }, 500);
    }
  });

  // Get the latest screenshot from the agent's browser
  router.get("/screenshot", (c) => {
    if (!latestScreenshot) {
      return c.json({ error: "No screenshot available" }, 404);
    }

    const age = Date.now() - latestScreenshot.timestamp;

    return c.json({
      url: latestScreenshot.url,
      data: latestScreenshot.data,
      timestamp: latestScreenshot.timestamp,
      age: age
    });
  });

  // Connect Playwright to Electron webview via CDP for shared browser
  router.post("/connect-cdp", async (c) => {
    if (!browserSession) {
      logger.error("CDP: Browser session not available");
      return c.json({ error: "Browser session not available" }, 500);
    }

    try {
      const body = await c.req.json<{ webSocketDebuggerUrl: string; targetId?: string }>();
      if (!body.webSocketDebuggerUrl) {
        logger.error("CDP: webSocketDebuggerUrl is required");
        return c.json({ error: "webSocketDebuggerUrl is required" }, 400);
      }

      logger.info("CDP: Connecting to embedded webview...");
      logger.info("CDP: URL = " + body.webSocketDebuggerUrl.substring(0, 80) + "...");

      // Connect Playwright to the webview via CDP
      await browserSession.connectViaCDP(body.webSocketDebuggerUrl);

      logger.info("CDP: ✓ Connected to embedded webview!");

      // Update BrowserController if it exists
      let ctrl = getBrowserController();
      if (!ctrl) {
        // Create a new BrowserController for this session
        const { BrowserController } = await import("../../browser/controller.js");
        ctrl = new BrowserController({
          onStep: (action, detail) => {
            logger.info("[BrowserController] " + action + ": " + detail);
          }
        });
      }

      ctrl.setSession(browserSession);
      logger.info("CDP: BrowserController updated with embedded webview session");

      // Mark CDP as connected and resolve any waiting promises
      cdpConnected = true;
      if ((waitForCdpConnection as any)._timeoutId) {
        clearTimeout((waitForCdpConnection as any)._timeoutId);
        (waitForCdpConnection as any)._timeoutId = null;
      }
      if (cdpResolver) {
        cdpResolver(true);
        cdpResolver = null;
      }
      if (cdpRejecter) {
        cdpRejecter = null;
      }

      return c.json({ success: true, message: "Connected to embedded webview" });
    } catch (err) {
      logger.error("CDP: ✗ Connection failed: " + (err instanceof Error ? err.message : String(err)));
      logger.error("CDP: Details: " + (err instanceof Error ? err.stack : "N/A"));

      // Reject any waiting promises on error
      if (cdpRejecter) {
        cdpRejecter(err instanceof Error ? err.message : String(err));
        cdpRejecter = null;
      }
      if (cdpResolver) {
        cdpResolver = null;
      }
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        details: "CDP connection to embedded webview failed"
      }, 500);
    }
  });

  // Browser view — renders the Playwright page as a stream of JPEG frames.
  // Same approach as Cursor: fast screenshot polling, forwarded user input via CDP.
  router.post("/ensure-started", async (c) => {
    const ctrl = getBrowserController();
    if (!ctrl) return c.json({ error: "No browser controller. Start an agent task first." }, 500);
    try {
      const session = ctrl.getSession();
      if (!session || !session.isStarted) {
        console.log('[BrowserAPI] Auto-starting browser for panel...');
        await ctrl.start();
      }
      const ctx = ctrl.getSession()?.context;
      if (ctx) {
        const pages = ctx.pages();
        if (pages.length === 0) {
          const page = await ctx.newPage();
          await page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
        }
      }
      const url = ctrl.getSession()?.context?.pages()[0]?.url() || 'about:blank';
      return c.json({ success: true, url });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  router.get("/screencast-frame", async (c) => {
    const ctrl = getBrowserController();
    if (!ctrl) return c.json({ error: "No browser controller" }, 500);

    const page = ctrl.getSession()?.context?.pages()[0];
    if (!page) return c.json({ error: "No page available" }, 404);

    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 80 });
      const frame = buf.toString('base64');
      return c.json({
        frame,
        url: page.url() || "about:blank",
        timestamp: Date.now(),
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  router.post("/screencast/input", async (c) => {
    const ctrl = getBrowserController();
    if (!ctrl) return c.json({ error: "No browser controller" }, 500);
    try {
      const body = await c.req.json<{
        mouse?: { type: string; x: number; y: number; button?: string; buttons?: number };
        key?: { type: string; key: string; code?: string; text?: string };
        scroll?: { deltaX: number; deltaY: number };
      }>();
      if (body.mouse) {
        await ctrl.dispatchMouse(
          body.mouse.type,
          body.mouse.x,
          body.mouse.y,
          body.mouse.button || 'left',
          body.mouse.buttons ?? (body.mouse.type === 'mouseReleased' ? 0 : 1),
        );
      }
      if (body.key) {
        await ctrl.dispatchKey(body.key.type, body.key.key, body.key.code, body.key.text);
      }
      if (body.scroll) {
        const page = ctrl.getSession()?.context?.pages()[0];
        if (page) await page.mouse.wheel(body.scroll.deltaX, body.scroll.deltaY);
      }
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Navigate browser to a URL — called from the URL bar
  router.post("/navigate", async (c) => {
    const ctrl = getBrowserController();
    if (!ctrl) return c.json({ error: "No browser controller" }, 500);
    try {
      const body = await c.req.json<{ url: string }>();
      if (!body.url) return c.json({ error: "url is required" }, 400);
      const result = await ctrl.navigate(body.url);
      return c.json({ success: true, result });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Manual browser action — user intervenes in the shared browser
  router.post("/action", async (c) => {
    const ctrl = getBrowserController();
    if (!ctrl) {
      return c.json({ error: "Browser not available" }, 500);
    }

    try {
      const body = await c.req.json<{
        action: 'type' | 'click' | 'clickAt' | 'navigate' | 'screenshot';
        text?: string;
        refId?: number;
        x?: number;
        y?: number;
        url?: string;
      }>();

      console.log("[Browser] Manual action:", body.action, body);

      switch (body.action) {
        case 'type':
          if (body.refId !== undefined && body.text !== undefined) {
            const result = await ctrl.typeText(body.refId, body.text, true);
            return c.json({ success: true, result });
          }
          break;
        case 'click':
          if (body.refId !== undefined) {
            const result = await ctrl.click(body.refId);
            return c.json({ success: true, result });
          }
          break;
        case 'clickAt':
          if (body.x !== undefined && body.y !== undefined) {
            const page = ctrl.getSession()?.context?.pages()[0];
            if (page) {
              await page.mouse.click(body.x, body.y);
              return c.json({ success: true, result: `Clicked at (${body.x}, ${body.y})` });
            }
          }
          break;
        case 'navigate':
          if (body.url) {
            const result = await ctrl.navigate(body.url);
            return c.json({ success: true, result });
          }
          break;
        case 'screenshot':
          const shot = await ctrl.screenshot();
          if (shot) {
            setLatestScreenshot(shot, body.url || '');
          }
          return c.json({ success: true, result: 'Screenshot taken' });
      }

      return c.json({ error: "Invalid or incomplete action parameters" }, 400);
    } catch (err) {
      console.error("[Browser] Manual action failed:", err);
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Human intervention endpoints — agent asks user for help, user clicks Done
  router.get("/intervention", (c) => {
    const intervention = getPendingIntervention();
    if (!intervention) {
      return c.json({ active: false });
    }
    return c.json({
      active: true,
      id: intervention.id,
      message: intervention.message,
    });
  });

  router.post("/intervention-done", async (c) => {
    const body = await c.req.json<{ message?: string }>();
    const resolved = resolveIntervention(body.message || 'User completed the task');
    if (!resolved) {
      return c.json({ error: "No pending intervention" }, 404);
    }
    console.log("[Intervention] User completed: ", body.message);
    return c.json({ success: true });
  });

  return router;
}
