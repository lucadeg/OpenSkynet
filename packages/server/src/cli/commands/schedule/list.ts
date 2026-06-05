import chalk from "chalk";
import { CronManager } from "../../../scheduler/cron.js";

export async function registerScheduleList(options: any): Promise<void> {
  try {
    const manager = new CronManager();
    const jobs = manager.listJobs();

    if (jobs.length === 0) {
      console.log(chalk.yellow("No scheduled jobs found."));
      return;
    }

    console.log(chalk.cyan(`Scheduled jobs (${jobs.length}):\n`));
    for (const job of jobs) {
      const id = chalk.gray(job.id);
      const enabled = job.enabled ? chalk.green("enabled") : chalk.red("disabled");
      const cron = chalk.magenta(job.cron);
      console.log(`  ${id}  ${cron}  ${enabled}`);
      console.log(`    Task: ${job.task}`);
      if (job.skill_name) {
        console.log(`    Skill: ${job.skill_name}`);
      }
      if (job.last_run) {
        console.log(`    Last run: ${job.last_run}`);
      }
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
