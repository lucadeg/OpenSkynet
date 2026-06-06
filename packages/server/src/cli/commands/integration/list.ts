import chalk from "chalk";
import { existsSync, readFileSync } from "node:fs";
import { getConfig } from "../../../core/config.js";

export async function registerIntegrationList(options: any): Promise<void> {
  try {
    const config = getConfig();
    const integrations = [
      { name: "slack", label: "Slack" },
      { name: "discord", label: "Discord" },
      { name: "telegram", label: "Telegram" },
      { name: "whatsapp", label: "WhatsApp" },
      { name: "wechat", label: "WeChat" },
      { name: "lark", label: "Lark" },
    ];

    let configured: Record<string, unknown> = {};
    if (existsSync(config.integrationsConfigPath)) {
      try {
        configured = JSON.parse(readFileSync(config.integrationsConfigPath, "utf-8"));
      } catch {}
    }

    console.log(chalk.cyan("Available integrations:\n"));
    for (const integration of integrations) {
      const hasConfig = integration.name in configured;
      const status = hasConfig ? chalk.green("[configured]") : chalk.gray("[not configured]");
      console.log(`  ${chalk.bold(integration.label)}  ${status}`);
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
