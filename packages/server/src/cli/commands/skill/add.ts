import chalk from "chalk";
import { SkillEngine } from "../../../skills/engine.js";

export async function registerSkillAdd(
  name: string,
  args: string[],
  options: any,
): Promise<void> {
  try {
    if (!name) {
      console.error(chalk.red("Error: skill name is required"));
      process.exit(1);
      return;
    }

    const description = options.description ?? args[0] ?? "";
    const steps = options.steps
      ? String(options.steps).split(",").map((s: string) => s.trim())
      : ["Perform the task described by the skill"];

    if (!description) {
      console.error(chalk.red("Error: description is required (--description or first positional arg)"));
      process.exit(1);
      return;
    }

    const engine = new SkillEngine();
    const skill = engine.create(name, description, steps, {
      category: options.category ?? "general",
      when_to_use: options.whenToUse,
    });

    console.log(chalk.green(`Created skill: ${name}`));
    console.log(chalk.gray(`  Description: ${description}`));
    console.log(chalk.gray(`  Steps: ${steps.length}`));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
