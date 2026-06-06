export function registerIntegrationCommand(cli: any): void {
  cli.action(async (subcommand: string, options: any) => {
    const args = process.argv.slice(process.argv.indexOf("integration") + 1);
    const cmd = args[0];

    switch (cmd) {
      case "list":
        await (await import("./list.js")).registerIntegrationList(options);
        break;
      case "configure":
        await (await import("./configure.js")).registerIntegrationConfigure(args.slice(1), options);
        break;
      case "test":
        await (await import("./test.js")).registerIntegrationTest(args[1], options);
        break;
      default:
        console.log("Usage: sediman integration <list|configure|test> [args]");
    }
  });
}
