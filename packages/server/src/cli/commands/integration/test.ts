import chalk from "chalk";
import { existsSync, readFileSync } from "node:fs";
import { getConfig } from "../../../core/config.js";

export async function registerIntegrationTest(name: string, options: any): Promise<void> {
  try {
    if (!name) {
      console.error(chalk.red("Error: integration name is required"));
      process.exit(1);
      return;
    }

    const config = getConfig();
    if (!existsSync(config.integrationsConfigPath)) {
      console.error(chalk.red("No integrations configured yet. Run `sediman integration configure` first."));
      process.exit(1);
      return;
    }

    let configured: Record<string, unknown>;
    try {
      configured = JSON.parse(readFileSync(config.integrationsConfigPath, "utf-8"));
    } catch {
      console.error(chalk.red("Failed to read integrations config."));
      process.exit(1);
      return;
    }

    if (!(name in configured)) {
      console.error(chalk.red(`Integration "${name}" is not configured.`));
      process.exit(1);
      return;
    }

    console.log(chalk.cyan(`Testing integration: ${name}...`));
    console.log(chalk.yellow("Integration testing is not yet fully implemented."));
    console.log(chalk.green(`Configuration for "${name}" found and loaded.`));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
