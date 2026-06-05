import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerBrowserHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("browser.configure", async (params) => {
    const headless = (params.headless as boolean) ?? true;
    deps.browserSession.headless = headless;
    deps.headless = headless;
    return { configured: true, headless };
  });

  server.register("browser.goto", async (params) => {
    const url = params.url as string;
    if (!url) return { success: false, error: "Missing url parameter" };
    if (!deps.browserSession.isStarted) {
      await deps.browserSession.start();
    }
    try {
      const msg = await deps.browserController.navigate(url);
      const success = !msg.startsWith("Failed");
      return { success, url: success ? url : undefined, error: success ? undefined : msg };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  server.register("browser.click", async (params) => {
    const selector = params.selector as string;
    const refId = params.ref_id as number | undefined;
    if (!deps.browserSession.isStarted) {
      return { success: false, error: "Browser not started" };
    }
    try {
      if (refId !== undefined) {
        const msg = await deps.browserController.click(refId);
        return { success: !msg.startsWith("Failed"), selector, error: msg.startsWith("Failed") ? msg : undefined };
      }
      return { success: false, selector, error: "No selector or ref_id provided" };
    } catch (err) {
      return { success: false, selector, error: (err as Error).message };
    }
  });

  server.register("browser.fill", async (params) => {
    const selector = params.selector as string;
    const value = params.value as string;
    const refId = params.ref_id as number | undefined;
    if (!deps.browserSession.isStarted) {
      return { success: false, error: "Browser not started" };
    }
    try {
      if (refId !== undefined) {
        const submit = params.submit as boolean | undefined;
        const msg = await deps.browserController.typeText(refId, value, submit);
        return { success: !msg.startsWith("Failed"), selector, error: msg.startsWith("Failed") ? msg : undefined };
      }
      return { success: false, selector, error: "No ref_id provided" };
    } catch (err) {
      return { success: false, selector, error: (err as Error).message };
    }
  });

  server.register("browser.wait", async (params) => {
    const selector = params.selector as string;
    const timeout = params.timeout as number | undefined;
    if (!deps.browserSession.isStarted) {
      return { success: false, error: "Browser not started" };
    }
    try {
      const msg = await deps.browserController.waitForSelector(selector, timeout);
      const success = !msg.startsWith("Timeout");
      return { success, selector, error: success ? undefined : msg };
    } catch (err) {
      return { success: false, selector, error: (err as Error).message };
    }
  });
}
