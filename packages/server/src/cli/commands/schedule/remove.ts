import chalk from "chalk";
import { CronManager } from "../../../scheduler/cron.js";

export async function registerScheduleRemove(jobId: string): Promise<void> {
  try {
    if (!jobId) {
      console.error(chalk.red("Error: job ID is required"));
      process.exit(1);
      return;
    }

    const manager = new CronManager();
    const removed = manager.removeJob(jobId);

    if (!removed) {
      console.error(chalk.red(`Job "${jobId}" not found.`));
      process.exit(1);
      return;
    }

    console.log(chalk.green(`Removed job: ${jobId}`));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
