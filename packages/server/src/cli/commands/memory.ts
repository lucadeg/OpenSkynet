import chalk from "chalk";
import { getAllEntries, searchEntries } from "../../memory/store.js";
import { initDb, closeDb } from "../../store/db.js";

export function registerMemoryCommand(cli: any): void {
  cli
    .command("memory", "Display memory contents")
    .option("--target <target>", "Filter by target: memory or user")
    .option("--search <query>", "Search memory entries")
    .option("--limit <n>", "Limit results", { default: 20 })
    .help()
    .action(async (options: any) => {
      try {
        initDb();

        if (options.search) {
          const entries = await searchEntries(options.search, Number(options.limit));
          if (entries.length === 0) {
            console.log(chalk.yellow("No matching entries found."));
            closeDb();
            return;
          }
          console.log(chalk.cyan(`Found ${entries.length} entries:\n`));
          for (const entry of entries) {
            const target = chalk.gray(`[${entry.target}]`);
            const type = chalk.magenta(`(${entry.type})`);
            console.log(`  ${target} ${type} ${entry.content}`);
          }
          closeDb();
          return;
        }

        const result = await getAllEntries();
        const entries = result.entries;

        const filtered = options.target
          ? entries.filter((e) => e.target === options.target)
          : entries;

        const limited = filtered.slice(0, Number(options.limit));

        if (limited.length === 0) {
          console.log(chalk.yellow("No memory entries found."));
          closeDb();
          return;
        }

        console.log(chalk.cyan(`Memory (${limited.length} entries):\n`));

        if (!options.target || options.target === "memory") {
          if (result.memory) {
            console.log(chalk.bold("System Memory:"));
            console.log(result.memory);
            console.log();
          }
        }

        if (!options.target || options.target === "user") {
          if (result.user) {
            console.log(chalk.bold("User Memory:"));
            console.log(result.user);
            console.log();
          }
        }
        closeDb();
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        closeDb();
        process.exit(1);
      }
    });
}
