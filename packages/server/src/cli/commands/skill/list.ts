import chalk from "chalk";
import { SkillEngine } from "../../../skills/engine.js";

export async function registerSkillList(): Promise<void> {
  try {
    const engine = new SkillEngine();
    const skills = engine.listSkills();

    if (skills.length === 0) {
      console.log(chalk.yellow("No skills found."));
      return;
    }

    console.log(chalk.cyan(`Skills (${skills.length}):\n`));
    for (const skill of skills) {
      const name = chalk.bold.green(skill.name as string);
      const category = chalk.gray(`[${skill.category ?? "general"}]`);
      const desc = (skill.description as string) ?? "";
      const version = chalk.magenta(`v${skill.version ?? 1}`);
      console.log(`  ${name} ${category} ${version}`);
      console.log(`    ${desc}`);
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
