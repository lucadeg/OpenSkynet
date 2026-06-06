import chalk from "chalk";
import { SkillEngine } from "../../skills/engine.js";
import { executeSkill } from "../../skills/executor.js";

export function registerRunCommand(cli: any): void {
  cli
    .command("run <task>", "Execute a one-shot task")
    .option("--provider <provider>", "LLM provider to use")
    .option("--model <model>", "Model to use")
    .option("--base-url <url>", "Custom base URL for the provider")
    .option("--headless", "Run browser in headless mode", { default: false })
    .option("--browser <browser>", "Browser binary path")
    .help()
    .action(async (task: string, options: any) => {
      try {
        console.log(chalk.cyan(`Running task: ${task}`));

        if (options.provider) {
          process.env.SEDIMAN_PROVIDER = options.provider;
        }
        if (options.model) {
          process.env.SEDIMAN_MODEL = options.model;
        }
        if (options.baseUrl) {
          process.env.SEDIMAN_BASE_URL = options.baseUrl;
        }

        console.log(chalk.yellow("Agent execution is not yet fully implemented."));
        console.log(chalk.gray(`Task: ${task}`));
        console.log(chalk.gray(`Provider: ${options.provider ?? "default"}`));
        console.log(chalk.gray(`Model: ${options.model ?? "default"}`));
        console.log(chalk.gray(`Headless: ${options.headless ?? false}`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
