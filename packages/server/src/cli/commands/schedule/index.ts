export function registerScheduleCommand(cli: any): void {
  cli.action(async (subcommand: string, options: any) => {
    const args = process.argv.slice(process.argv.indexOf("schedule") + 1);
    const cmd = args[0];
    const rest = args.slice(1);

    switch (cmd) {
      case "list":
        await (await import("./list.js")).registerScheduleList(options);
        break;
      case "add":
        await (await import("./add.js")).registerScheduleAdd(rest, options);
        break;
      case "remove":
        await (await import("./remove.js")).registerScheduleRemove(rest[0]);
        break;
      case "start":
        await (await import("./start.js")).registerScheduleStart(options);
        break;
      default:
        console.log("Usage: sediman schedule <list|add|remove|start> [args]");
    }
  });
}
