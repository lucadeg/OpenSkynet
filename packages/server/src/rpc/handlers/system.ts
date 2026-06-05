import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerSystemHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("system.status", async () => ({
    running: true,
    uptime_secs: server.getUptimeSecs(),
    browser_open: deps.browserSession.isStarted,
    tasks_completed: deps.tasksCompleted,
  }));

  server.register("system.screenshot", async () => {
    const screenshot = await deps.browserSession.takeScreenshot();
    return { screenshot: screenshot ?? "" };
  });

  server.register("system.btw", async () => {
    const response = await deps.llmProvider.chat(
      [{ role: "user", content: "Answer briefly in one sentence." }],
      [],
    );
    return { answer: response.text ?? "No response" };
  });

  server.register("system.doctor", async () => {
    const checks: Record<string, boolean> = {};
    try {
      const { chromium } = await import("playwright");
      checks.playwright = !!chromium;
    } catch {
      checks.playwright = false;
    }
    try {
      const { execSync } = await import("node:child_process");
      execSync("python3 --version", { stdio: "ignore" });
      checks.python = true;
    } catch {
      checks.python = false;
    }
    try {
      const { execSync } = await import("node:child_process");
      execSync("docker --version", { stdio: "ignore" });
      checks.docker = true;
    } catch {
      checks.docker = false;
    }
    return { checks };
  });
}
