import chalk from "chalk";
import { SkillEngine } from "../../../skills/engine.js";
import { executeSkill } from "../../../skills/executor.js";

export async function registerSkillRun(name: string, options: any): Promise<void> {
  try {
    if (!name) {
      console.error(chalk.red("Error: skill name is required"));
      process.exit(1);
      return;
    }

    const engine = new SkillEngine();
    const skill = engine.read(name);

    if (!skill) {
      console.error(chalk.red(`Skill "${name}" not found.`));
      process.exit(1);
      return;
    }

    engine.recordUsage(name);
    console.log(chalk.cyan(`Running skill: ${name}`));
    console.log(chalk.gray(`Description: ${skill.description}`));

    const steps = skill.steps as string[];
    console.log(chalk.gray(`Steps: ${steps.length}`));
    for (let i = 0; i < steps.length; i++) {
      console.log(chalk.white(`  ${i + 1}. ${steps[i]}`));
    }

    const result = await executeSkill(skill, null, null);
    console.log(chalk.green("\nResult:"));
    console.log(result);
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
