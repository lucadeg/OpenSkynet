import chalk from "chalk";
import { CronManager, validateCronExpr } from "../../../scheduler/cron.js";

export async function registerScheduleAdd(args: string[], options: any): Promise<void> {
  try {
    const cronExpr = args[0];
    const task = args.slice(1).join(" ");

    if (!cronExpr || !task) {
      console.error(chalk.red("Error: cron expression and task are required"));
      console.log(chalk.gray("Usage: sediman schedule add '<cron>' '<task>'"));
      process.exit(1);
      return;
    }

    if (!validateCronExpr(cronExpr)) {
      console.error(chalk.red(`Error: invalid cron expression: "${cronExpr}"`));
      process.exit(1);
      return;
    }

    const manager = new CronManager();
    const jobId = manager.addJob(
      cronExpr,
      task,
      options.skill,
      options.provider,
      options.model,
      options.baseUrl,
      options.notify,
    );

    console.log(chalk.green(`Scheduled job created: ${jobId}`));
    console.log(chalk.gray(`  Cron: ${cronExpr}`));
    console.log(chalk.gray(`  Task: ${task}`));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
