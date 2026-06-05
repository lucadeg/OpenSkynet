import chalk from "chalk";
import { SkillEngine } from "../../../skills/engine.js";
import { HubClient, GitHubInstaller } from "../../../skills/hub.js";
import { getConfig } from "../../../core/config.js";

export async function registerSkillInstall(ref: string, options: any): Promise<void> {
  try {
    if (!ref) {
      console.error(chalk.red("Error: skill reference is required (name or GitHub URL)"));
      process.exit(1);
      return;
    }

    const engine = new SkillEngine();
    const config = getConfig();
    const force = options.force ?? false;

    if (ref.includes("github.com") || ref.includes("/")) {
      const installer = new GitHubInstaller(config.skillsDir);
      const result = await installer.install(ref, engine, force);
      console.log(chalk.green(result.message));
      return;
    }

    const hub = new HubClient();
    const result = await hub.install(ref, engine, force);
    console.log(chalk.green(result.message));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
