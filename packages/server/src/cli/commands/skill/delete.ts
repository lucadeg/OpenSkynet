import chalk from "chalk";
import { SkillEngine } from "../../../skills/engine.js";

export async function registerSkillDelete(name: string): Promise<void> {
  try {
    if (!name) {
      console.error(chalk.red("Error: skill name is required"));
      process.exit(1);
      return;
    }

    const engine = new SkillEngine();
    const deleted = engine.delete(name);

    if (!deleted) {
      console.error(chalk.red(`Skill "${name}" not found.`));
      process.exit(1);
      return;
    }

    console.log(chalk.green(`Deleted skill: ${name}`));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
