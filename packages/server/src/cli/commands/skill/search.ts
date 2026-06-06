import chalk from "chalk";
import { SkillSearchEngine } from "../../../skills/search.js";
import { SkillEngine } from "../../../skills/engine.js";

export async function registerSkillSearch(query: string, options: any): Promise<void> {
  try {
    if (!query) {
      console.error(chalk.red("Error: search query is required"));
      process.exit(1);
      return;
    }

    const engine = new SkillEngine();
    const searcher = new SkillSearchEngine(engine);
    const scope = (options.scope as "internal" | "hub" | "all") ?? "all";
    const limit = Number(options.limit ?? 10);

    const results = await searcher.search(query, scope, limit);

    if (results.length === 0) {
      console.log(chalk.yellow("No skills found matching your query."));
      return;
    }

    console.log(chalk.cyan(`Search results (${results.length}):\n`));
    for (const result of results) {
      const name = chalk.bold.green(result.name);
      const source = chalk.gray(`[${result.source ?? "local"}]`);
      const score = chalk.magenta(`(score: ${result.score.toFixed(1)})`);
      console.log(`  ${name} ${source} ${score}`);
      console.log(`    ${result.description}`);
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
