import chalk from "chalk";
import { CronScheduler } from "../../../scheduler/cron.js";

export async function registerScheduleStart(options: any): Promise<void> {
  try {
    console.log(chalk.cyan("Starting scheduler..."));
    const scheduler = new CronScheduler();
    scheduler.start();
    console.log(chalk.green("Scheduler is running. Press Ctrl+C to stop."));

    process.on("SIGINT", () => {
      scheduler.stop();
      console.log(chalk.yellow("\nScheduler stopped."));
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      scheduler.stop();
      process.exit(0);
    });

    await new Promise(() => {});
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
