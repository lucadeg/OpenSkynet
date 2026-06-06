import chalk from "chalk";
import { SkillEngine } from "../../../skills/engine.js";
import { GitHubInstaller } from "../../../skills/hub.js";
import { getConfig } from "../../../core/config.js";

export async function registerSkillUpdate(name: string, options: any): Promise<void> {
  try {
    if (!name) {
      console.error(chalk.red("Error: skill name is required"));
      process.exit(1);
      return;
    }

    const engine = new SkillEngine();
    const config = getConfig();
    const existing = engine.read(name);

    if (!existing) {
      console.error(chalk.red(`Skill "${name}" not found.`));
      process.exit(1);
      return;
    }

    const source = existing.source as string;
    if (source?.startsWith("github:")) {
      const installer = new GitHubInstaller(config.skillsDir);
      const result = await installer.updateSkill(name, engine);
      if (result.updated) {
        console.log(chalk.green(result.message));
      } else {
        console.log(chalk.yellow(result.message));
      }
      return;
    }

    if (source === "hub") {
      const { HubClient } = await import("../../../skills/hub.js");
      const hub = new HubClient();
      const result = await hub.install(name, engine, true);
      console.log(chalk.green(result.message));
      return;
    }

    console.log(chalk.yellow(`Skill "${name}" is locally created. No remote source to update from.`));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
