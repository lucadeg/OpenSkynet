import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { getConfig } from "../../core/config.js";

export function registerIntegrationHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("integration.list", async () => {
    const config = getConfig();
    if (!existsSync(config.integrationsConfigPath)) {
      return { integrations: [] };
    }
    try {
      const data = JSON.parse(readFileSync(config.integrationsConfigPath, "utf-8"));
      return { integrations: Object.entries(data).map(([name, cfg]) => ({ name, ...cfg as Record<string, unknown> })) };
    } catch {
      return { integrations: [] };
    }
  });

  server.register("integration.configure", async (params) => {
    const name = params.name as string;
    const settings = params.settings as Record<string, unknown>;
    const config = getConfig();
    let data: Record<string, unknown> = {};
    if (existsSync(config.integrationsConfigPath)) {
      try {
        data = JSON.parse(readFileSync(config.integrationsConfigPath, "utf-8"));
      } catch {
        data = {};
      }
    }
    data[name] = settings;
    writeFileSync(config.integrationsConfigPath, JSON.stringify(data, null, 2));
    return { configured: true, name };
  });

  server.register("integration.send", async (params) => {
    const _name = params.name as string;
    const _message = params.message as string;
    return { sent: true };
  });

  server.register("integration.status", async (params) => {
    const name = params.name as string;
    const config = getConfig();
    if (!existsSync(config.integrationsConfigPath)) {
      return { name, configured: false };
    }
    try {
      const data = JSON.parse(readFileSync(config.integrationsConfigPath, "utf-8"));
      return { name, configured: name in data, settings: data[name] ?? null };
    } catch {
      return { name, configured: false };
    }
  });
}
