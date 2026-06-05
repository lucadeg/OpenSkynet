import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getConfig } from "../../../core/config.js";

export async function registerIntegrationConfigure(args: string[], options: any): Promise<void> {
  try {
    const name = args[0];
    if (!name) {
      console.error(chalk.red("Error: integration name is required"));
      console.log(chalk.gray("Available: slack, discord, telegram, whatsapp, wechat, lark"));
      process.exit(1);
      return;
    }

    const valid = ["slack", "discord", "telegram", "whatsapp", "wechat", "lark"];
    if (!valid.includes(name)) {
      console.error(chalk.red(`Unknown integration: "${name}"`));
      console.log(chalk.gray(`Available: ${valid.join(", ")}`));
      process.exit(1);
      return;
    }

    const config = getConfig();
    let configured: Record<string, unknown> = {};
    if (existsSync(config.integrationsConfigPath)) {
      try {
        configured = JSON.parse(readFileSync(config.integrationsConfigPath, "utf-8"));
      } catch {}
    }

    const token = options.token ?? process.env[`${name.toUpperCase()}_TOKEN`] ?? "";
    if (!token) {
      console.error(chalk.red(`Error: token is required. Use --token or set ${name.toUpperCase()}_TOKEN env var.`));
      process.exit(1);
      return;
    }

    configured[name] = {
      enabled: true,
      token,
      ...(options.channel ? { channel: options.channel } : {}),
      ...(options.webhook ? { webhook: options.webhook } : {}),
    };

    mkdirSync(dirname(config.integrationsConfigPath), { recursive: true });
    writeFileSync(config.integrationsConfigPath, JSON.stringify(configured, null, 2) + "\n", "utf-8");

    console.log(chalk.green(`Configured integration: ${name}`));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
