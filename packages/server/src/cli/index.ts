import { cac } from "cac";
import { registerRunCommand } from "./commands/run.js";
import { registerChatCommand } from "./commands/chat.js";
import { registerServeCommand } from "./commands/serve.js";
import { registerMemoryCommand } from "./commands/memory.js";
import { registerSessionsCommand } from "./commands/sessions.js";
import { registerSkillCommand } from "./commands/skill/index.js";
import { registerScheduleCommand } from "./commands/schedule/index.js";
import { registerIntegrationCommand } from "./commands/integration/index.js";

export function createCLI(): ReturnType<typeof cac> {
  const cli = cac("sediman");

  cli.version("0.3.14").usage("<command> [options]").help();

  registerRunCommand(cli);
  registerChatCommand(cli);
  registerServeCommand(cli);
  registerMemoryCommand(cli);
  registerSessionsCommand(cli);

  const skillCmd = cli.command("skill <subcommand>", "Skill management");
  registerSkillCommand(skillCmd);

  const scheduleCmd = cli.command("schedule <subcommand>", "Schedule management");
  registerScheduleCommand(scheduleCmd);

  const integrationCmd = cli.command("integration <subcommand>", "Integration management");
  registerIntegrationCommand(integrationCmd);

  return cli;
}

export async function runCLI(argv?: string[]): Promise<void> {
  const cli = createCLI();
  try {
    cli.parse(argv ?? process.argv, { run: false });
    if (!cli.matchedCommand && !cli.options.help && !cli.options.version) {
      cli.outputHelp();
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
