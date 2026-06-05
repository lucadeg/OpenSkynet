import chalk from "chalk";
import { SkillEngine } from "../../../skills/engine.js";

export async function registerSkillRecord(name: string, options: any): Promise<void> {
  try {
    if (!name) {
      console.error(chalk.red("Error: skill name is required"));
      process.exit(1);
      return;
    }

    const engine = new SkillEngine();
    const existing = engine.read(name);
    if (existing) {
      engine.recordUsage(name);
      console.log(chalk.green(`Recorded usage for skill: ${name}`));
      console.log(chalk.gray(`  Use count: ${(existing.use_count as number ?? 0) + 1}`));
      return;
    }

    console.error(chalk.red(`Skill "${name}" not found.`));
    process.exit(1);
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
