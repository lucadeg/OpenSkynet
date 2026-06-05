import chalk from "chalk";
import { getRecentSessions, searchSessions } from "../../memory/sessions.js";
import { initDb, closeDb } from "../../store/db.js";

export function registerSessionsCommand(cli: any): void {
  cli
    .command("sessions", "Show recent sessions")
    .option("--limit <n>", "Number of sessions to show", { default: 20 })
    .option("--search <query>", "Search sessions by query")
    .help()
    .action(async (options: any) => {
      try {
        initDb();
        const limit = Number(options.limit);

        let sessions;
        if (options.search) {
          sessions = await searchSessions(options.search, limit);
        } else {
          sessions = await getRecentSessions(limit);
        }

        if (sessions.length === 0) {
          console.log(chalk.yellow("No sessions found."));
          closeDb();
          return;
        }

        console.log(chalk.cyan(`Recent sessions (${sessions.length}):\n`));
        for (const session of sessions) {
          const id = chalk.gray(session.id.slice(0, 8));
          const date = chalk.magenta(new Date(session.created_at).toLocaleString());
          const result = session.result
            ? chalk.green(` -> ${session.result.slice(0, 80)}`)
            : "";
          console.log(`  ${id}  ${date}  ${session.task}${result}`);
        }
        closeDb();
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        closeDb();
        process.exit(1);
      }
    });
}
