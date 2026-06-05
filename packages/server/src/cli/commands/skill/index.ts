export function registerSkillCommand(cli: any): void {
  cli
    .option("list", "List all skills")
    .option("run <name>", "Run a skill")
    .option("show <name>", "Show skill details")
    .option("delete <name>", "Delete a skill")
    .option("add <name>", "Add a new skill")
    .option("record <name>", "Record a skill")
    .option("install <ref>", "Install a skill from hub or GitHub")
    .option("search <query>", "Search for skills")
    .option("update <name>", "Update a skill")
    .option("hub <subcommand>", "Hub: browse, search, install, info, publish");

  cli.action(async (subcommand: string, options: any) => {
    const { registerSkillList } = await import("./list.js");
    const { registerSkillRun } = await import("./run.js");
    const { registerSkillShow } = await import("./show.js");
    const { registerSkillDelete } = await import("./delete.js");
    const { registerSkillAdd } = await import("./add.js");
    const { registerSkillRecord } = await import("./record.js");
    const { registerSkillInstall } = await import("./install.js");
    const { registerSkillSearch } = await import("./search.js");
    const { registerSkillUpdate } = await import("./update.js");
    const { registerSkillHub } = await import("./hub.js");

    const args = process.argv.slice(process.argv.indexOf("skill") + 1);
    const cmd = args[0];
    const rest = args.slice(1);

    switch (cmd) {
      case "list":
        await registerSkillList();
        break;
      case "run":
        await registerSkillRun(rest[0], options);
        break;
      case "show":
        await registerSkillShow(rest[0]);
        break;
      case "delete":
        await registerSkillDelete(rest[0]);
        break;
      case "add":
        await registerSkillAdd(rest[0], rest, options);
        break;
      case "record":
        await registerSkillRecord(rest[0], options);
        break;
      case "install":
        await registerSkillInstall(rest[0], options);
        break;
      case "search":
        await registerSkillSearch(rest.join(" "), options);
        break;
      case "update":
        await registerSkillUpdate(rest[0], options);
        break;
      case "hub":
        await registerSkillHub(rest);
        break;
      default:
        console.log("Usage: sediman skill <list|run|show|delete|add|record|install|search|update|hub> [args]");
    }
  });
}
