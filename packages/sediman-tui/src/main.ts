#!/usr/bin/env bun
/**
 * Sediman TUI — REPL with real-time autocomplete popup.
 * Uses enquirer AutoComplete (matching Python's prompt_toolkit).
 */
import chalk from "chalk"
import { ApiClient, runAgentTask } from "./bridge.js"

const bridge = new ApiClient()

interface Cmd { names: string[]; desc: string; cat: string; run: (args: string) => Promise<void> }
const CMDS: Cmd[] = []

function reg(names: string[], desc: string, cat: string, run: (args: string) => Promise<void>) {
  CMDS.push({ names, desc, cat, run })
}

const allCmdNames = () => CMDS.flatMap(c => c.names).filter(n => n.startsWith("/"))

// ── Commands ─────────────────────────────────────────────────────
reg(["/help", "/h", "/?"], "Show available commands", "General", async () => {
  const cats = new Map<string, string[]>()
  for (const c of CMDS) {
    const n = c.names[0]
    if (n.startsWith("/") && !n.includes(" ")) {
      const l = cats.get(c.cat) || []
      l.push(`  ${chalk.cyan(n.padEnd(16))} ${chalk.gray(c.desc)}`)
      cats.set(c.cat, l)
    }
  }
  let out = chalk.bold.blue("Commands") + "\n"
  for (const [cat, items] of cats) out += `\n${chalk.bold.yellow(cat)}\n${items.join("\n")}\n`
  out += `\n${chalk.gray("Tab:autocomplete  │  ↑↓:history  │  Esc:cancel  │  ^C:exit")}`
  console.log(out)
})
reg(["/exit", "/quit", "/q"], "Exit Sediman", "General", async () => process.exit(0))
reg(["/clear", "/cls"], "Clear screen", "General", async () => { console.clear(); printBanner() })
reg(["/status", "/st"], "Show server status", "Info", async () => {
  try { const s = await bridge.status(); console.log(chalk.bold("Status") + `\n  Provider: ${chalk.cyan(s.provider || "?")}  Model: ${chalk.cyan(s.model || "?")}\n  Browser: ${s.browser_open ? chalk.green("open") : chalk.gray("closed")}  Jobs: ${s.scheduler?.active_jobs || 0} active`) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/model"], "Switch: /model <provider> [model]", "Agent", async (a) => {
  const p = a.trim().split(/\s+/)
  if (!p[0]) { console.log(chalk.yellow("Usage: /model <provider> [model]")); return }
  try { await bridge.switchModel(p[0], p[1]); console.log(chalk.green("→") + ` ${p[0]}${p[1] ? " / " + p[1] : ""}`) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/models"], "List available providers", "Agent", async () => {
  try { const p = await bridge.listProviders(); console.log(chalk.bold("Providers") + "\n" + p.map((x: any) => `  ${chalk.cyan(x.name)} → ${x.default_model || "?"}`).join("\n")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/skills", "/sk"], "List installed skills", "Skills", async () => {
  try { const s = await bridge.listSkills(); console.log(s.length ? chalk.bold(`Skills (${s.length})`) + "\n" + s.map((x: any) => `  ${chalk.cyan(x.name)} ${chalk.gray((x.description || "").slice(0, 50))}`).join("\n") : chalk.gray("No skills")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/skill"], "Show skill details: /skill <name>", "Skills", async (a) => {
  if (!a.trim()) { console.log(chalk.yellow("Usage: /skill <name>")); return }
  try { const s = await bridge.getSkill(a.trim()); console.log(s ? chalk.bold(s.name) + ` v${s.version || 1}  ${chalk.gray(s.description || "")}` : chalk.red("Not found")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/run"], "Execute skill: /run <name>", "Skills", async (a) => {
  if (!a.trim()) { console.log(chalk.yellow("Usage: /run <name>")); return }
  try { console.log(await bridge.executeSkill(a.trim())) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/hub"], "Browse skill hub", "Skills", async () => {
  try { const h = await bridge.hubBrowse(); console.log(chalk.bold(`Hub (${h.length})`) + "\n" + h.slice(0, 20).map((x: any) => `  ${chalk.cyan(x.name)} ${chalk.gray((x.description || "").slice(0, 50))}`).join("\n") + (h.length > 20 ? `\n${chalk.gray("+" + (h.length - 20) + " more")}` : "")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/hub-install"], "Install: /hub-install <name>", "Skills", async (a) => {
  if (!a.trim()) { console.log(chalk.yellow("Usage: /hub-install <name>")); return }
  try { console.log(chalk.green(await bridge.hubInstall(a.trim()) || "Installed")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/memory", "/mem"], "Show memory usage", "Info", async () => {
  try { const m = await bridge.getMemory(); const u = m.usage?.memory; console.log(chalk.bold("Memory") + `\n  ${u?.chars || 0}/${u?.limit || 2200} (${u?.pct || 0}%)`) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/remember", "/rmb"], "Add memory: /remember <text>", "Info", async (a) => {
  if (!a.trim()) { console.log(chalk.yellow("Usage: /remember <text>")); return }
  try { await bridge.addMemory("memory", a.trim()); console.log(chalk.green("Remembered.")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/sessions", "/ss"], "Recent sessions", "Info", async () => {
  try { const s = await bridge.listSessions(); console.log(s.length ? chalk.bold("Sessions") + "\n" + s.slice(0, 10).map((x: any) => `  ${chalk.gray((x.created_at || "").slice(0, 16))} ${(x.task || "").slice(0, 50)}`).join("\n") : chalk.gray("No sessions")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/schedule", "/sched"], "Scheduled jobs", "Info", async () => {
  try { const j = await bridge.listSchedules(); console.log(j.length ? chalk.bold("Jobs") + "\n" + j.map((x: any) => `  ${chalk.cyan(x.cron)} ${(x.task || "").slice(0, 50)}${x.skill_name ? chalk.gray(" (" + x.skill_name + ")") : ""}`).join("\n") : chalk.gray("No jobs")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/doctor", "/diag"], "System diagnostics", "Info", async () => {
  try { const d = await bridge.doctor(); const ch = d.checks || {}; console.log(chalk.bold("Diagnostics") + "\n" + Object.entries(ch).map(([k, v]) => `  ${v ? chalk.green("✓") : chalk.red("✗")} ${k}`).join("\n")) }
  catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})
reg(["/terminal", "/term"], "Toggle: /terminal [on|off]", "Agent", async (a) => {
  const v = a.trim().toLowerCase()
  try {
    if (v === "on" || v === "off") { await bridge.setTerminal(v === "on"); console.log(chalk.green("Terminal: " + v)) }
    else { const s = await bridge.getTerminalStatus(); console.log(chalk.bold("Terminal: ") + (s ? chalk.green("on") : chalk.gray("off"))) }
  } catch (e: any) { console.log(chalk.red("✗ ") + e.message) }
})

// ── Banner ──────────────────────────────────────────────────────
function printBanner() {
  const lines = [
    chalk.cyan.bold("    ______                   __  __"),
    chalk.cyan.bold("   /      \\                 /  |/  |"),
    chalk.cyan.bold("  /$$$$$$  |  ______    ____$$ |$$/  _____  ____    ______   _______"),
    chalk.cyan.bold("  $$ \\__$$/  /      \\  /    $$ |/  |/     \\/    \\  /      \\ /       \\"),
    chalk.cyan.bold("  $$      \\ /$$$$$$  |/$$$$$$$ |$$ |$$$$$$ $$$$  | $$$$$$  |$$$$$$$  |"),
    chalk.cyan.bold("   $$$$$$  |$$    $$ |$$ |  $$ |$$ |$$ | $$ | $$ | /    $$ |$$ |  $$ |"),
    chalk.cyan.bold("  /  \\__$$ |$$$$$$$$/ $$ \\__$$ |$$ |$$ | $$ | $$ |/$$$$$$$ |$$ |  $$ |"),
    chalk.cyan.bold("  $$    $$/ $$       |$$    $$ |$$ |$$ | $$ | $$ |$$    $$ |$$ |  $$ |"),
    chalk.cyan.bold("   $$$$$$/   $$$$$$$/  $$$$$$$/ $$/ $$/  |$$/  $$/  $$$$$$$/ $$/   $$/"),
  ]
  for (const l of lines) console.log(l)
  console.log()
}

// ── Dispatch ────────────────────────────────────────────────────
async function dispatch(text: string) {
  if (text.startsWith("/")) {
    const parts = text.split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const tw = parts.length >= 2 ? `${cmd} ${parts[1]}`.toLowerCase() : ""
    const def = CMDS.find(c => c.names.includes(tw)) || CMDS.find(c => c.names.includes(cmd))
    if (def) { await def.run(tw ? parts.slice(2).join(" ") : parts.slice(1).join(" ")) }
    else {
      console.log(chalk.red("✗ Unknown: ") + cmd)
      console.log(chalk.gray("  Try ") + chalk.cyan("/help"))
    }
    return
  }

  const t0 = Date.now()
  console.log(chalk.cyan.bold("━") + " " + chalk.white.bold(text))

  await new Promise<void>((resolve, reject) => {
    runAgentTask(
      text,
      (phase, action, url) => {
        const icon = { planning: "◈", executing: "▶", observing: "◎" }[phase] || "•"
        const color = { planning: chalk.yellow, executing: chalk.blue, observing: chalk.cyan }[phase] || chalk.white
        const label = url ? `${action} (${url})` : action
        process.stdout.write(`  ${color(icon)} ${label}\n`)
      },
      (err) => {
        console.log(chalk.red("✗ ") + err)
        resolve()
      },
      (result, sec, name) => {
        const elapsed = sec >= 60 ? `${Math.floor(sec / 60)}m${sec % 60}s` : `${sec}s`
        console.log(`\n${chalk.green("┃")} ${chalk.green.bold("Done")} (${elapsed})${name ? chalk.cyan(" ◆ " + name) : ""}`)
        if (result) console.log(result.slice(0, 2000))
        console.log()
        resolve()
      },
    )
  })
}

// ── REPL Loop ────────────────────────────────────────────────────
async function main() {
  console.clear()
  printBanner()

  // Import enquirer dynamically (it's ESM/CJS hybrid)
  const enquirer = await import("enquirer")
  const { AutoComplete } = enquirer.default as any

  try {
    const s = await bridge.status()
    const skills = await bridge.listSkills().catch(() => [])
    console.log(`  ${chalk.green("*")} Browser: ${s.browser_open ? chalk.green("open") : "headed + vision"}`)
    if (skills.length) console.log(`  ${chalk.yellow("*")} ${skills.length} skill(s) loaded`)
    for (const sk of skills.slice(0, 3)) {
      const data = sk as any
      console.log(`      ${chalk.cyan("-")} ${data.name.padEnd(25)} ${(data.description || "").slice(0, 50)}`)
    }
    console.log()
    console.log(`  ${chalk.cyan("/help")} for commands   ${chalk.cyan("/exit")} to quit   just type to run a task`)
    console.log(`  ${chalk.gray("─".repeat(52))}`)
    console.log()
  } catch {
    console.log(`  ${chalk.red("○")} Backend offline — start with: ${chalk.cyan("bun run start")}`)
    console.log()
  }

  let taskCount = 0

  // REPL loop with autocomplete
  while (true) {
    const prompt = new AutoComplete({
      name: "input",
      message: chalk.cyan("▸"),
      prefix: "",
      limit: 8,
      choices: allCmdNames(),
      suggest: (input: string, choices: any[]) => {
        if (!input || !input.startsWith("/")) {
          // Free-form text or empty: return the input itself as a choice
          // so the user can press Enter to submit it as an agent task
          return input ? [{ name: input, message: input, value: input }] : []
        }
        return choices.filter((c: any) => c.name.startsWith(input))
      },
    })

    let answer: string
    try {
      answer = (await prompt.run()) as string
    } catch {
      // Cancelled or error - exit cleanly
      console.log(chalk.gray("\nBye!"))
      process.exit(0)
    }

    if (!answer?.trim()) continue
    const text = answer.trim()

    taskCount++
    await dispatch(text)
  }
}

main().catch((e) => { console.error(chalk.red("Fatal: ") + e.message); process.exit(1) })
