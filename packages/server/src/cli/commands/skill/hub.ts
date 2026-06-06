import chalk from "chalk";
import { SkillEngine } from "../../../skills/engine.js";
import { HubClient } from "../../../skills/hub.js";

export async function registerSkillHub(args: string[]): Promise<void> {
  try {
    const subcommand = args[0];
    const rest = args.slice(1);

    switch (subcommand) {
      case "browse": {
        const hub = new HubClient();
        const category = rest[0];
        const skills = await hub.browse(category);
        if (skills.length === 0) {
          console.log(chalk.yellow("No skills found on hub."));
          return;
        }
        console.log(chalk.cyan(`Hub skills (${skills.length}):\n`));
        for (const skill of skills) {
          const installed = skill.installed ? chalk.green("[installed]") : "";
          const name = chalk.bold(skill.name);
          console.log(`  ${name} ${chalk.gray(`[${skill.category}]`)} ${installed}`);
          console.log(`    ${skill.description}`);
        }
        break;
      }

      case "search": {
        const query = rest.join(" ");
        if (!query) {
          console.error(chalk.red("Error: search query is required"));
          process.exit(1);
          return;
        }
        const hub = new HubClient();
        const skills = await hub.search(query);
        if (skills.length === 0) {
          console.log(chalk.yellow("No skills found matching your query."));
          return;
        }
        console.log(chalk.cyan(`Hub search results (${skills.length}):\n`));
        for (const skill of skills) {
          const name = chalk.bold(skill.name);
          console.log(`  ${name} ${chalk.gray(`[${skill.category}]`)}`);
          console.log(`    ${skill.description}`);
        }
        break;
      }

      case "install": {
        const name = rest[0];
        if (!name) {
          console.error(chalk.red("Error: skill name is required"));
          process.exit(1);
          return;
        }
        const engine = new SkillEngine();
        const hub = new HubClient();
        const force = rest.includes("--force");
        const result = await hub.install(name, engine, force);
        console.log(chalk.green(result.message));
        break;
      }

      case "info": {
        const name = rest[0];
        if (!name) {
          console.error(chalk.red("Error: skill name is required"));
          process.exit(1);
          return;
        }
        const hub = new HubClient();
        const info = await hub.info(name);
        console.log(chalk.cyan(`Skill: ${info.name ?? name}`));
        if (info.description) console.log(chalk.bold("Description:"), info.description as string);
        if (info.category) console.log(chalk.bold("Category:"), info.category as string);
        if (info.author) console.log(chalk.bold("Author:"), info.author as string);
        if (info.version) console.log(chalk.bold("Version:"), String(info.version));
        break;
      }

      case "publish": {
        const name = rest[0];
        if (!name) {
          console.error(chalk.red("Error: skill name is required"));
          process.exit(1);
          return;
        }
        const engine = new SkillEngine();
        const hub = new HubClient();
        const result = await hub.publish(name, engine);
        console.log(chalk.green(result.message));
        break;
      }

      default:
        console.log("Usage: sediman skill hub <browse|search|install|info|publish> [args]");
        break;
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}
