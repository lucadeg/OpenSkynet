import chalk from "chalk";

export function registerChatCommand(cli: any): void {
  cli
    .command("chat", "Start an interactive chat session")
    .option("--port <port>", "RPC server port", { default: 9257 })
    .option("--mode <mode>", "Chat mode: tui or rpc", { default: "tui" })
    .help()
    .action(async (options: any) => {
      try {
        console.log(chalk.cyan("Starting interactive chat session..."));
        console.log(chalk.yellow("Chat mode is not yet fully implemented."));
        console.log(chalk.gray(`Mode: ${options.mode}`));
        console.log(chalk.gray(`Port: ${options.port}`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
