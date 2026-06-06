import { render, useRenderer, useKeyboard, useTerminalDimensions, usePaste } from "@opentui/solid";
import { RGBA, type CliRenderer, type TextareaRenderable, type ScrollBoxRenderable, type SelectRenderable, type InputRenderable } from "@opentui/core";
import {
  App,
  type TUIDeps,
  type SelectItem,
  type ModalType,
  type ChatMessage,
} from "./app.js";
import { THEMES, type ThemeTokens, getTheme } from "./theme.js";
import { TUIConfig } from "./config.js";
import { runAgentStream } from "../agent/stream-run.js";
import {
  createSignal,
  createEffect,
  onCleanup,
  untrack,
  For,
  Show,
  Switch,
  Match,
  type Setter,
} from "solid-js";

export type { TUIDeps } from "./app.js";

function rgba(hex: string): RGBA {
  return RGBA.fromHex(hex);
}

function formatElapsed(secs: number): string {
  if (secs < 1) return "< 1s";
  if (secs < 60) return `${Math.floor(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.floor(secs % 60)}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x1100 && (
      code <= 0x115f || code === 0x2329 || code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1f64f) ||
      (code >= 0x1f900 && code <= 0x1f9ff) ||
      (code >= 0x20000 && code <= 0x2fffd) ||
      (code >= 0x30000 && code <= 0x3fffd)
    )) w += 2;
    else w += 1;
  }
  return w;
}

function truncateStr(s: string, max: number): string {
  let w = 0;
  let result = "";
  for (const ch of s) {
    const cw = displayWidth(ch);
    if (w + cw > max) {
      if (max - w >= 1) result += "…";
      break;
    }
    result += ch;
    w += cw;
  }
  return result;
}

const LOGO_LINES = [
  "   ____                  _____ __                    __ ",
  "  / __ \\____  ___  ____ / ___// /____  ______  ___  / /_",
  " / / / / __ \\ / _ \\/ __ \\\\__ \\/ //_/ / / / __ \\/ _ \\/ __/",
  "/ /_/ / /_/ /  __/ / / /__/ / ,< / /_/ / / / /  __/ /_ ",
  "\\____/ .___/\\___/_/ /_/____/_/|_|\\__, /_/ /_/\\___/\\__/",
  "    /_/                         /____/                 ",
];

const LOGO_COLORS = ["primary", "secondary", "info", "warning", "error", "primary"];

export async function startTUI(deps: TUIDeps): Promise<void> {
  const config = TUIConfig.load();
  const app = new App(config.provider || "openai", config.model || null, config.baseUrl || null, deps.headless);
  app.themeName = config.theme || "opencode";
  app.load();

  let destroyed = false;

  try {
    await render(
      () => <TUIApp app={app} deps={deps} />,
      {
        exitOnCtrlC: false,
        targetFps: 30,
        onDestroy: () => { destroyed = true; },
      },
    );
  } catch (err) {
    process.stderr.write("Render failed: " + (err instanceof Error ? err.stack : String(err)) + "\n");
  }

  await new Promise<void>((resolve) => {
    const iv = setInterval(() => { if (destroyed) { clearInterval(iv); resolve(); } }, 200);
  });
}

function TUIApp(props: { app: App; deps: TUIDeps }) {
  const renderer = useRenderer();
  const dims = useTerminalDimensions();

  const [inputText, setInputText] = createSignal("");
  const [messages, setMessages] = createSignal<ChatMessage[]>([...props.app.messages]);
  const [agentRunning, setAgentRunning] = createSignal(false);
  const [spinnerChar, setSpinnerChar] = createSignal("");
  const [agentStartTime, setAgentStartTime] = createSignal(0);
  const [agentMode, setAgentMode] = createSignal(props.app.agent.mode);
  const [agentPhase, setAgentPhase] = createSignal("");
  const [showBanner, setShowBanner] = createSignal(props.app.showBanner);
  const [toastText, setToastText] = createSignal("");
  const [modalType, setModalType] = createSignal<ModalType | null>(null);
  const [modalItems, setModalItems] = createSignal<SelectItem[]>([]);
  const [modalSelectedIndex, setModalSelectedIndex] = createSignal(0);
  const [modalInputValue, setModalInputValue] = createSignal("");
  const [modalInfoTitle, setModalInfoTitle] = createSignal("");
  const [modalInfoLines, setModalInfoLines] = createSignal<string[]>([]);
  const [themeName, setThemeName] = createSignal(props.app.themeName);
  const [provider, setProvider] = createSignal(props.app.provider);
  const [model, setModel] = createSignal(props.app.model ?? "default");

  let textareaRef: TextareaRenderable | undefined;
  let scrollRef: ScrollBoxRenderable | undefined;
  let selectRef: SelectRenderable | undefined;

  const app = props.app;
  const deps = props.deps;

  function theme(): ThemeTokens {
    return getTheme(themeName());
  }

  function syncFromApp(): void {
    setMessages([...app.messages]);
    setAgentRunning(app.agent.running);
    setSpinnerChar(app.spinnerChar);
    setAgentStartTime(app.agent.startTime);
    setAgentMode(app.agent.mode);
    setAgentPhase(app.agent.streamingPhase);
    setShowBanner(app.showBanner);
    setToastText(app.toastText);
    setThemeName(app.themeName);
    setProvider(app.provider);
    setModel(app.model ?? "default");
  }

  function openModal(type: ModalType): void {
    app.openModal(type);
    setModalType(type);
    setModalSelectedIndex(0);
    setModalItems([...app.modal.items]);
    setModalInputValue("");
    setModalInfoTitle(app.modal.infoTitle);
    setModalInfoLines([...app.modal.infoLines]);
    if (textareaRef) textareaRef.blur();
  }

  function closeModal(): void {
    app.closeModal();
    setModalType(null);
    setModalItems([]);
    setModalInputValue("");
    setTimeout(() => textareaRef?.focus(), 0);
  }

  function showToast(text: string): void {
    app.showToast(text);
    setToastText(text);
  }

  const ticker = setInterval(() => {
    if (app.agent.running) {
      app.advanceSpinner();
      syncFromApp();
    }
    if (app.toastExpiry && Date.now() > app.toastExpiry) {
      app.toastText = "";
      app.toastExpiry = 0;
      setToastText("");
    }
  }, 200);

  onCleanup(() => clearInterval(ticker));

  createEffect(() => {
    if (!modalType() && textareaRef) {
      textareaRef.focus();
    }
  });

  useKeyboard((key) => {
    if (modalType()) return;

    if (key.ctrl && key.name === "/") { openModal("help"); return; }
    if (key.ctrl && key.name === "t") {
      app.cycleTheme();
      syncFromApp();
      showToast(`Theme: ${app.themeName}`);
      return;
    }
    if (key.ctrl && key.name === "s") { app.toggleSteps(); syncFromApp(); return; }

    if (key.name === "escape" && agentRunning()) {
      app.agent.running = false;
      app.agent.streamingPhase = "";
      syncFromApp();
      showToast("Agent cancelled");
      return;
    }

    if (key.name === "tab" && !key.shift) {
      app.cycleAgentMode();
      syncFromApp();
      showToast(`Mode: ${app.agent.mode}`);
      return;
    }
  });

  async function submitInput(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInputText("");

    if (trimmed.startsWith("/")) {
      await handleSlashCommand(trimmed);
      syncFromApp();
      return;
    }

    if (trimmed.startsWith("!")) {
      handleShellCommand(trimmed);
      syncFromApp();
      return;
    }

    await submitTask(trimmed);
  }

  async function submitTask(text: string): Promise<void> {
    if (app.agent.running) { showToast("Agent is already running"); return; }

    app.inputHistory.push(text);
    app.addUserMessage(text, ++app.agent.taskCount);
    app.agent.running = true;
    app.agent.startTime = Date.now();
    app.agent.retryAttempt = null;
    app.agent.retryCountdown = null;
    app.agent.validationConfidence = null;
    app.agent.validationIssues = null;
    app.agent.reflectionStatus = false;
    app.startAgentMessage(text);
    app.showBanner = false;
    syncFromApp();

    const modeName = app.currentModeName();
    try {
      for await (const event of runAgentStream(deps, text, { mode: modeName })) {
        switch (event.type) {
          case "thinking": app.appendStreamingToken(event.token, "thinking"); break;
          case "streaming": app.appendStreamingToken(event.token, event.phase); break;
          case "step": app.appendStep(event.action); break;
          case "progress":
            app.updateProgress({
              kind: event.kind, currentAttempt: event.data?.attempt,
              maxAttempts: event.data?.max, countdownSeconds: event.data?.countdown,
              confidence: event.data?.confidence, issuesCount: event.data?.issues,
            });
            break;
          case "result": app.completeAgent(event.success, event.result ?? "", event.elapsedSecs); break;
          case "error": app.addErrorMessage(event.message); app.agent.running = false; app.agent.streamingPhase = ""; break;
        }
        syncFromApp();
      }
    } catch (err) {
      app.addErrorMessage(err instanceof Error ? err.message : String(err));
      app.agent.running = false;
      app.agent.streamingPhase = "";
    }
    syncFromApp();
  }

  function handleShellCommand(text: string): void {
    const cmd = text.slice(1).trim();
    if (!cmd) return;
    try {
      const result = require("child_process").execSync(cmd, { timeout: 30000, encoding: "utf-8" }).trim();
      app.addSystemMessage(`$ ${cmd}\n${result || "(no output)"}`);
    } catch (err: any) {
      app.addErrorMessage(`$ ${cmd}\n${err.stderr || err.message}`);
    }
  }

  async function handleSlashCommand(text: string): Promise<void> {
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case "/help": case "/h": openModal("help"); break;
      case "/quit": case "/exit": case "/q": app.save(); renderer.destroy(); break;
      case "/clear": case "/cls": app.messages = []; app.showBanner = true; syncFromApp(); break;
      case "/reset": app.messages = []; app.showBanner = true; app.agent.running = false; app.agent.streamingPhase = ""; app.agent.taskCount = 0; syncFromApp(); break;
      case "/compress":
        if (app.messages.length > 10) { app.messages = app.messages.slice(-10); app.addSystemMessage("Compressed to last 10 messages"); }
        syncFromApp(); break;
      case "/status": {
        const lines = ["## System Status", `  Uptime: ${formatElapsed(process.uptime())}`, `  Browser: ${app.headless ? "headless" : "headed"}`, `  Tasks: ${app.agent.taskCount}`, `  Provider: ${app.provider}/${app.model ?? "auto"}`, `  Mode: ${app.agent.mode}`, `  Theme: ${app.themeName}`];
        app.modal.infoTitle = "Status"; app.modal.infoLines = lines; app.modal.scrollOffset = 0;
        setModalInfoTitle("Status"); setModalInfoLines(lines);
        openModal("info"); break;
      }
      case "/models": case "/model": {
        openModal("modelPicker");
        await loadModels();
        if (args.length > 0 && args[0].includes("/")) {
          const [p, mdl] = args[0].split("/");
          app.provider = p; app.model = mdl;
          try { await deps.llmProvider.switch?.(p, mdl); } catch {}
          showToast(`Switched to ${p}/${mdl}`); closeModal();
        }
        break;
      }
      case "/provider": case "/providers": openModal("providerPicker"); await loadProviders(); break;
      case "/connect": openModal("connectPicker"); await loadIntegrations(); break;
      case "/skills": case "/skill": {
        if (args[0] === "run" && args[1]) {
          try { await deps.skillEngine.run?.(args[1]); showToast(`Skill ${args[1]} executed`); }
          catch (e: any) { app.addErrorMessage(`Skill error: ${e.message}`); }
          syncFromApp(); return;
        }
        openModal("skillBrowser"); await loadSkills(); break;
      }
      case "/memory": case "/mem":
        openModal("memoryMenu");
        setModalItems([{ id: "stats", label: "View Memory Stats" }, { id: "switch", label: "Switch Memory System" }, { id: "edit", label: "Edit Memory" }]);
        break;
      case "/remember":
        if (!args.length) { showToast("Usage: /remember <text>"); return; }
        try { await deps.memory.add?.(args.join(" ")); showToast("Remembered!"); }
        catch (e: any) { app.addErrorMessage(`Memory error: ${e.message}`); }
        syncFromApp(); break;
      case "/sessions": openModal("sessionBrowser"); await loadSessions(); break;
      case "/schedule": case "/cron": openModal("scheduleBrowser"); await loadSchedule(); break;
      case "/themes": case "/theme":
        if (args.length > 0) {
          const found = THEMES.find((th) => th.name === args[0].toLowerCase());
          if (found) { app.themeName = found.name; syncFromApp(); showToast(`Theme: ${found.name}`); return; }
        }
        openModal("themePicker"); break;
      case "/coder":
        if (args.length > 0) { app.agent.coderBackend = args[0]; showToast(`Coder: ${args[0]}`); return; }
        openModal("coderPicker");
        setModalItems(["internal", "claude-code", "codex", "opencode"].map(v => ({ id: v, label: v })));
        break;
      case "/search":
        if (args.length > 0) { app.agent.searchMode = args[0]; showToast(`Search: ${args[0]}`); return; }
        openModal("searchModePicker");
        setModalItems(["auto", "simple", "advanced"].map(v => ({ id: v, label: v })));
        break;
      case "/browser":
        if (args.length > 0) { app.headless = args[0] === "headless"; showToast(`Browser: ${app.headless ? "headless" : "headed"}`); return; }
        openModal("browserModePicker");
        setModalItems([{ id: "headless", label: "headless" }, { id: "headed", label: "headed" }]);
        break;
      case "/doctor": await runDoctor(); break;
      case "/soul":
        if (args.length > 0) {
          if (args[0] === "reset") { try { await deps.llmProvider?.resetSoul?.(); showToast("Soul reset"); } catch {} return; }
          try { await deps.llmProvider?.setSoul?.(args.join(" ")); showToast("Soul updated"); } catch {}
          return;
        }
        openModal("soulEditor");
        try { setModalInputValue(await deps.llmProvider?.getSoul?.() ?? ""); } catch { setModalInputValue(""); }
        break;
      case "/checkpoint": case "/branches": openModal("checkpointBrowser"); await loadCheckpoints(); break;
      case "/checkpoint-create": case "/branch": {
        const name = args[0] ?? "manual";
        try { await deps.checkpointManager?.create?.(name, args[1] ?? process.cwd()); showToast(`Checkpoint "${name}" created`); }
        catch (e: any) { app.addErrorMessage(`Checkpoint error: ${e.message}`); }
        syncFromApp(); break;
      }
      case "/delegate":
        if (!args.length) { showToast("Usage: /delegate <task>"); return; }
        submitTask(args.join(" ")); break;
      case "/parallel": {
        const tasks = text.split("|").map(tp => tp.replace(/^\/parallel\s*/, "").trim()).filter(Boolean);
        for (const task of tasks.slice(0, 5)) submitTask(task);
        break;
      }
      default: showToast(`Unknown: ${cmd} · try /help`);
    }
  }

  async function loadModels(): Promise<void> {
    try {
      const providers = await deps.llmProvider.listProviders?.() ?? [];
      const items: SelectItem[] = [];
      for (const p of providers) {
        try {
          const models = await deps.llmProvider.listModels?.(p.id ?? p.name) ?? [];
          for (const mdl of models) items.push({ id: `${p.id ?? p.name}/${mdl.id ?? mdl.name}`, label: mdl.id ?? mdl.name, category: p.name ?? p.id });
        } catch { items.push({ id: `${p.id ?? p.name}`, label: "(error)", category: p.name ?? p.id }); }
      }
      const final = items.length ? items : [{ id: "openai/gpt-4", label: "gpt-4", category: "openai" }, { id: "anthropic/claude-3.5-sonnet", label: "claude-3.5-sonnet", category: "anthropic" }];
      app.modal.items = final;
      setModalItems(final);
    } catch { setModalItems([{ id: "error", label: "Failed to load models" }]); }
  }

  async function loadProviders(): Promise<void> {
    try {
      const providers = await deps.llmProvider.listProviders?.() ?? [];
      const items = providers.map((p: any) => ({ id: p.id ?? p.name, label: p.name ?? p.id, installed: !!p.hasKey }));
      app.modal.items = items;
      setModalItems(items);
    } catch { setModalItems([{ id: "openai", label: "OpenAI", installed: false }, { id: "anthropic", label: "Anthropic", installed: false }]); }
  }

  async function loadSkills(): Promise<void> {
    try {
      const local = await deps.skillEngine.list?.() ?? [];
      const hub = await deps.hubClient.browse?.() ?? [];
      const installedNames = new Set(local.map((s: any) => s.name));
      const items = [
        ...local.map((s: any) => ({ id: s.name, label: s.name, installed: true })),
        ...hub.filter((s: any) => !installedNames.has(s.name)).map((s: any) => ({ id: s.name, label: s.name, installed: false })),
      ];
      app.modal.items = items;
      setModalItems(items);
    } catch { setModalItems([]); }
  }

  async function loadSchedule(): Promise<void> {
    try {
      const jobs = await deps.cronManager.list?.() ?? [];
      setModalItems(jobs.map((j: any) => ({ id: j.id ?? String(j), label: j.task ?? j.name ?? String(j) })));
    } catch { setModalItems([]); }
  }

  async function loadSessions(): Promise<void> {
    try {
      const sessions = await deps.memory?.getSessionHistory?.() ?? [];
      setModalItems(sessions.map((s: any) => ({ id: s.id ?? String(s), label: s.task ?? s.text ?? String(s) })));
    } catch { setModalItems([]); }
  }

  async function loadCheckpoints(): Promise<void> {
    try {
      const checkpoints = await deps.checkpointManager.list?.() ?? [];
      setModalItems(checkpoints.map((c: any) => ({ id: c.id ?? String(c), label: c.name ?? c.id ?? String(c) })));
    } catch { setModalItems([]); }
  }

  async function loadIntegrations(): Promise<void> {
    const defaults = [{ name: "Discord" }, { name: "Telegram" }, { name: "Slack" }, { name: "WhatsApp" }, { name: "Lark" }, { name: "WeChat" }];
    try {
      const integrations = await deps.llmProvider?.listIntegrations?.() ?? defaults;
      setModalItems(integrations.map((ig: any) => ({ id: ig.name?.toLowerCase() ?? String(ig), label: ig.name ?? String(ig), connected: ig.configured ?? ig.connected ?? false })));
    } catch { setModalItems(defaults.map(d => ({ id: d.name.toLowerCase(), label: d.name, connected: false }))); }
  }

  async function runDoctor(): Promise<void> {
    const lines: string[] = ["Running diagnostics...", ""];
    const checks = [
      { cat: "Browser", name: "Playwright", check: async () => { try { await import("playwright"); return "✓ Installed"; } catch { return "✗ Not installed"; } } },
      { cat: "AI & LLM", name: "OpenAI SDK", check: async () => { try { await import("openai"); return "✓ Installed"; } catch { return "✗ Not installed"; } } },
      { cat: "Memory", name: "File Memory", check: async () => { try { const stats = await deps.memory?.getStats?.(); return `✓ ${stats?.total ?? 0} entries`; } catch { return "✗ Not initialized"; } } },
      { cat: "Skills", name: "Skill Engine", check: async () => { try { const skills = await deps.skillEngine?.list?.(); return `✓ ${skills?.length ?? 0} skills`; } catch { return "✗ Not available"; } } },
    ];
    let currentCat = "";
    for (const chk of checks) {
      if (chk.cat !== currentCat) { currentCat = chk.cat; lines.push(`## ${currentCat}`); }
      lines.push(`  ${chk.name}: ${await chk.check()}`);
    }
    lines.push("", "✓ All checks complete");
    app.modal.infoLines = lines;
    setModalInfoTitle("Diagnostics");
    setModalInfoLines(lines);
    openModal("doctor");
  }

  function onModalSelect(index: number, _option: any): void {
    const m = app.modal;
    const items = modalItems();
    const item = items[index];
    if (!item) return;
    app.modal.selectedIndex = index;

    switch (modalType()) {
      case "modelPicker":
        if (item.category) { app.provider = item.category; setProvider(item.category); }
        app.model = item.label; setModel(item.label);
        try { deps.llmProvider.switch?.(item.category ?? app.provider, item.label); } catch {}
        showToast(`Switched to ${item.category ?? app.provider}/${item.label}`);
        closeModal(); break;
      case "providerPicker":
        if (!item.installed) { setModalType("apiKeyPrompt"); setModalInputValue(""); app.modal.pendingAction = item.id; }
        else { app.provider = item.id; setProvider(item.id); showToast(`Provider: ${item.label}`); closeModal(); }
        break;
      case "connectPicker":
        if (!item.connected) { setModalType("apiKeyPrompt"); setModalInputValue(""); app.modal.pendingAction = item.id; }
        else { try { deps.llmProvider?.disconnect?.(item.id); showToast(`Disconnected ${item.label}`); } catch {} closeModal(); }
        break;
      case "skillBrowser":
        if (item.installed) { try { deps.skillEngine.run?.(item.id); showToast(`Skill ${item.id} executed`); } catch {} }
        else { try { deps.hubClient.install?.(item.id); showToast(`Installed ${item.id}`); } catch {} }
        closeModal(); break;
      case "memoryMenu":
        if (item.id === "edit") { setModalType("memoryEditor"); }
        else if (item.id === "switch") { setModalType("memorySystemPicker"); setModalItems(["file", "sqlite", "vector"].map(s => ({ id: s, label: s }))); }
        break;
      case "memorySystemPicker":
        try { deps.memory?.switchSystem?.(item.id); showToast(`Memory: ${item.id}`); } catch {}
        closeModal(); break;
      case "coderPicker":
        app.agent.coderBackend = item.id; showToast(`Coder: ${item.id}`); closeModal(); break;
      case "searchModePicker":
        app.agent.searchMode = item.id; showToast(`Search: ${item.id}`); closeModal(); break;
      case "browserModePicker":
        app.headless = item.id === "headless"; showToast(`Browser: ${app.headless ? "headless" : "headed"}`); closeModal(); break;
      case "checkpointBrowser":
        try { deps.checkpointManager.revert?.(item.id, process.cwd()); showToast(`Reverted to ${item.label}`); }
        catch (e: any) { app.addErrorMessage(`Revert failed: ${e.message}`); syncFromApp(); }
        closeModal(); break;
      case "themePicker":
        const selectedTheme = THEMES[index];
        if (selectedTheme) {
          app.themeName = selectedTheme.name;
          setThemeName(selectedTheme.name);
          showToast(`Theme: ${selectedTheme.name}`);
        }
        closeModal(); break;
      default: closeModal();
    }
  }

  const t = theme;
  const w = () => dims().width;

  return (
    <box width={w()} height={dims().height} flexDirection="column" backgroundColor={rgba(t().background)}>
      <TitleBar t={t} w={w} provider={provider} model={model} agentRunning={agentRunning} spinnerChar={spinnerChar} agentStartTime={agentStartTime} app={app} />

      <box flexGrow={1} minHeight={0} flexDirection="column">
        <SafeShow when={!showBanner() || messages().length > 0} fallback={<Banner t={t} app={app} />}>
          <MessageList messages={messages} t={t} w={w} agentRunning={agentRunning} spinnerChar={spinnerChar} agentStartTime={agentStartTime} agentPhase={agentPhase} app={app}
            onRef={(ref) => { scrollRef = ref; }} />
        </SafeShow>
      </box>

      <box flexShrink={0} flexDirection="column" paddingLeft={2} paddingRight={2}>
        <PromptInput
          t={t} app={app} agentRunning={agentRunning} agentMode={agentMode} model={model} provider={provider}
          onSubmit={submitInput}
          onRef={(ref) => { textareaRef = ref; }}
        />
        <PromptMeta t={t} agentMode={agentMode} model={model} provider={provider} agentRunning={agentRunning} spinnerChar={spinnerChar} agentPhase={agentPhase} app={app} />
      </box>

      <Footer t={t} w={w} />

      <box>
        <SafeShow when={toastText() !== ""}>
          <Toast text={toastText} t={t} />
        </SafeShow>
      </box>

      <box>
        <SafeShow when={modalType() !== null}>
          <Dialog
            type={modalType()}
            items={modalItems}
            selectedIndex={modalSelectedIndex}
            inputValue={modalInputValue}
            infoTitle={modalInfoTitle}
            infoLines={modalInfoLines}
            t={t}
            w={w}
            app={app}
            deps={deps}
            onClose={closeModal}
            onSelect={onModalSelect}
            onInputValueChange={setModalInputValue}
            onSelectedIndexChange={setModalSelectedIndex}
          />
        </SafeShow>
      </box>
    </box>
  );
}

function TitleBar(props: {
  t: () => ThemeTokens; w: () => number; provider: () => string; model: () => string;
  agentRunning: () => boolean; spinnerChar: () => string; agentStartTime: () => number; app: App;
}) {
  return (
    <box height={1} backgroundColor={rgba(props.t().background)}>
      <text fg={rgba(props.t().primary)}>
        {` ◆ OpenSkynet${props.agentRunning() ? ` ${props.spinnerChar()}` : ""} `}
      </text>
      <text fg={rgba(props.t().textMuted)}>v{props.app.version} </text>
      <text fg={rgba(props.t().text)}>{" ".repeat(Math.max(0, props.w() - 50))}</text>
      <text fg={rgba(props.t().textMuted)}>{props.provider()} </text>
      <text fg={rgba(props.t().border)}>· </text>
      <text fg={rgba(props.t().text)}>{props.model()} </text>
      <text fg={rgba(props.t().border)}>· </text>
      <text fg={rgba(props.agentRunning() ? props.t().success : props.t().textMuted)}>
        {props.agentRunning() && props.agentStartTime() ? formatElapsed((Date.now() - props.agentStartTime()) / 1000) : "idle"}
      </text>
    </box>
  );
}

function Banner(props: { t: () => ThemeTokens; app: App }) {
  const t = props.t;
  return (
    <scrollbox flexGrow={1} stickyScroll={true} stickyStart="bottom" flexDirection="column" paddingLeft={2} paddingRight={2}>
      <box height={1} />
      <For each={LOGO_LINES}>
        {(line, i) => (
          <text height={1} fg={rgba(t()[LOGO_COLORS[i()] as keyof ThemeTokens] ?? t().primary)}>{line}</text>
        )}
      </For>
      <box height={1} />
      <text height={1} fg={rgba(t().info)}>Your Terminator.</text>
      <text height={1} fg={rgba(t().textMuted)}>v{props.app.version}</text>
      <box height={1} />
      <text height={1} fg={rgba(t().text)}>{"● Browser: " + (props.app.headless ? "headless" : "headed + vision")}</text>
      <text height={1} fg={rgba(t().text)}>{"◎ Path: " + process.cwd().slice(-50)}</text>
      <box height={1} />
      <text height={1} fg={rgba(t().textMuted)}>Type a task or /help to begin.</text>
      <box height={1} />
    </scrollbox>
  );
}

function MessageList(props: {
  messages: () => ChatMessage[]; t: () => ThemeTokens; w: () => number;
  agentRunning: () => boolean; spinnerChar: () => string; agentStartTime: () => number;
  agentPhase: () => string; app: App;
  onRef: (ref: ScrollBoxRenderable) => void;
}) {
  return (
    <scrollbox
      ref={props.onRef}
      flexGrow={1}
      stickyScroll={true}
      stickyStart="bottom"
      flexDirection="column"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
    >
      <For each={props.messages()}>
        {(msg, i) => <MessageRow msg={msg} t={props.t} w={props.w} app={props.app} />}
      </For>
      <SafeShow when={props.agentRunning()}>
        <AgentSpinner agentRunning={props.agentRunning} spinnerChar={props.spinnerChar} agentStartTime={props.agentStartTime} t={props.t} messages={props.messages} app={props.app} />
      </SafeShow>
    </scrollbox>
  );
}

function MessageRow(props: { msg: ChatMessage; t: () => ThemeTokens; w: () => number; app: App }) {
  const msg = props.msg;
  const t = props.t;
  const maxW = () => props.w() - 4;

  return (
    <box flexDirection="column">
      <Switch fallback={<text height={1} fg={rgba(t().textMuted)}>{" "}</text>}>
        <Match when={msg.type === "user"}>
          <text height={1} fg={rgba(t().secondary)}>{`❯ ${truncateStr(msg.text ?? "", maxW())}`}</text>
        </Match>
      <Match when={msg.type === "system"}>
        <text height={1} fg={rgba(t().textMuted)}>{`  ${truncateStr(msg.text ?? "", maxW())}`}</text>
      </Match>
      <Match when={msg.type === "error"}>
        <text height={1} fg={rgba(t().error)}>{`✗ ${truncateStr(msg.text ?? "", maxW())}`}</text>
      </Match>
      <Match when={msg.type === "agent" && msg.state === "streaming"}>
        <AgentStreamingMessage msg={msg} t={t} w={props.w} app={props.app} />
      </Match>
      <Match when={msg.type === "agent" && msg.state === "completed"}>
        <AgentCompletedMessage msg={msg} t={t} w={props.w} app={props.app} />
      </Match>
    </Switch>
    </box>
  );
}

function AgentStreamingMessage(props: { msg: ChatMessage; t: () => ThemeTokens; w: () => number; app: App }) {
  const msg = props.msg;
  const t = props.t;
  const maxW = () => props.w() - 4;

  return (
    <box flexDirection="column">
      <SafeShow when={!!(msg.thinkingText && msg.thinkingText.length > 0)}>
        <text height={1} fg={rgba(t().warning)}>◆ Thinking</text>
        <For each={msg.thinkingText!.split("\n").slice(-5).filter((l: string) => l.trim())}>
          {(line) => <text height={1} fg={rgba(t().textMuted)}>{`  ${truncateStr(line.trim(), maxW())}`}</text>}
        </For>
      </SafeShow>
      <SafeShow when={!!(msg.steps?.length)}>
        <text height={1} fg={rgba(t().info)}>{`▸ ${msg.steps!.length} steps`}</text>
        <For each={msg.steps!.slice(-8)}>
          {(step) => <text height={1} fg={rgba(t().text)}>{`  ${truncateStr(step, maxW())}`}</text>}
        </For>
      </SafeShow>
      <SafeShow when={!!(msg.result && msg.result.length > 0)}>
        <text height={1} fg={rgba(t().info)}>▶ Response</text>
        <For each={msg.result!.split("\n").slice(-15)}>
          {(line) => <text height={1} fg={rgba(t().text)}>{`  ${truncateStr(line, maxW())}`}</text>}
        </For>
      </SafeShow>
    </box>
  );
}

function AgentCompletedMessage(props: { msg: ChatMessage; t: () => ThemeTokens; w: () => number; app: App }) {
  const msg = props.msg;
  const t = props.t;
  const maxW = () => props.w() - 4;
  const icon = msg.success ? "✓" : "✗";
  const iconColor = msg.success ? t().success : t().error;
  const elapsed = msg.elapsedSecs ?? 0;
  const sel = msg.selectedTab ?? "response";

  return (
    <box flexDirection="column">
      <text height={1} fg={rgba(iconColor)}>{`${icon} Done · ${formatElapsed(elapsed)}`}</text>
      <SafeShow when={msg.tabExpanded && sel === "response" && msg.result}>
        <For each={msg.result!.split("\n").slice(0, 30)}>
          {(line) => <text height={1} fg={rgba(t().text)}>{`  ${truncateStr(line, maxW())}`}</text>}
        </For>
      </SafeShow>
      <SafeShow when={msg.tabExpanded && sel === "steps" && msg.steps}>
        <For each={msg.steps!.slice(-5)}>
          {(step) => <text height={1} fg={rgba(t().text)}>{`  ${truncateStr(step, maxW())}`}</text>}
        </For>
      </SafeShow>
      <SafeShow when={msg.tabExpanded && sel === "thinking" && msg.thinkingText}>
        <For each={msg.thinkingText!.split("\n").slice(0, 20).filter((l: string) => l.trim())}>
          {(line) => <text height={1} fg={rgba(t().textMuted)}>{`  ${truncateStr(line.trim(), maxW())}`}</text>}
        </For>
      </SafeShow>
      <SafeShow when={!!msg.skillCreated}>
        <text height={1} fg={rgba(t().info)}>{`  ✦ Skill created: ${msg.skillCreated}`}</text>
      </SafeShow>
      <SafeShow when={!!msg.scheduledJob}>
        <text height={1} fg={rgba(t().secondary)}>{`  ⏰ Scheduled: ${msg.scheduledJob}`}</text>
      </SafeShow>
    </box>
  );
}

function AgentSpinner(props: {
  agentRunning: () => boolean; spinnerChar: () => string; agentStartTime: () => number;
  t: () => ThemeTokens; messages: () => ChatMessage[]; app: App;
}) {
  const msgs = props.messages();
  const lastMsg = msgs[msgs.length - 1];
  const elapsed = props.agentStartTime() ? (Date.now() - props.agentStartTime()) / 1000 : 0;
  const stepCount = lastMsg?.type === "agent" ? (lastMsg.steps?.length ?? 0) : 0;
  const show = props.agentRunning() && lastMsg?.type === "agent" && lastMsg.state === "streaming";

  return (
    <box>
      <SafeShow when={show}>
        <text height={1} fg={rgba(props.t().primary)}>
          {`${props.spinnerChar()} Working… ${formatElapsed(elapsed)} · ${stepCount} steps`}
        </text>
      </SafeShow>
    </box>
  );
}

function PromptInput(props: {
  t: () => ThemeTokens; app: App; agentRunning: () => boolean; agentMode: () => string;
  model: () => string; provider: () => string;
  onSubmit: (text: string) => void;
  onRef: (ref: TextareaRenderable) => void;
}) {
  let ref: TextareaRenderable | undefined;

  return (
    <textarea
      ref={(r: TextareaRenderable) => { ref = r; props.onRef(r); }}
      height={1}
      minHeight={1}
      maxHeight={5}
      textColor={rgba(props.t().text)}
      backgroundColor={rgba(props.t().backgroundElement)}
      focusedBackgroundColor={rgba(props.t().backgroundElement)}
      focusedTextColor={rgba(props.t().text)}
      placeholder={'Ask anything... "Fix a TODO in the codebase"'}
      placeholderColor={rgba(props.t().textMuted)}
      onSubmit={() => {
        if (!ref) return;
        const text = ref.plainText ?? "";
        if (!text.trim()) return;
        ref.clear();
        props.onSubmit(text);
      }}
      onContentChange={() => {}}
    />
  );
}

function SafeShow<T>(props: { when: T | false | null | undefined; fallback?: JSX.Element; children: JSX.Element | ((item: T) => JSX.Element) }) {
  const inner = (
    <Show when={props.when} fallback={props.fallback ?? <box />}>
      {props.children}
    </Show>
  );
  return <box>{inner}</box>;
}

function PromptMeta(props: {
  t: () => ThemeTokens; agentMode: () => string; model: () => string;
  provider: () => string; agentRunning: () => boolean; spinnerChar: () => string;
  agentPhase: () => string; app: App;
}) {
  const modeColorMap: Record<string, string> = {};
  const t = props.t;

  function modeColor(): string {
    const mode = props.agentMode();
    if (mode === "Manager") return t().primary;
    if (mode === "Browser") return t().success;
    if (mode === "Coder") return t().warning;
    if (mode === "Terminator") return t().error;
    return t().primary;
  }

  const modeLabel = () => props.app.currentModeLabel();
  const hint = () => props.agentRunning() ? `${props.spinnerChar()} Processing...` : "";

  return (
    <box height={1}>
      <text fg={rgba(modeColor())}>{` ${modeLabel()} `}</text>
      <text fg={rgba(t().textMuted)}>{"· "}</text>
      <text fg={rgba(t().textMuted)}>{`${props.model()} `}</text>
      <text fg={rgba(t().textMuted)}>{"· "}</text>
      <text fg={rgba(t().textMuted)}>{`${props.provider()} `}</text>
      <SafeShow when={hint()}>
        <text fg={rgba(t().primary)}>{`  ${hint()}`}</text>
      </SafeShow>
    </box>
  );
}

function Footer(props: { t: () => ThemeTokens; w: () => number }) {
  const cwd = process.cwd();
  const cwdDisplay = cwd.length > 35 ? "..." + cwd.slice(cwd.length - 32) : cwd;

  return (
    <box height={1} backgroundColor={rgba(props.t().background)}>
      <text fg={rgba(props.t().textMuted)}>{` ~/...${cwdDisplay}`}</text>
      <text fg={rgba(props.t().text)}>{" ".repeat(Math.max(0, props.w() - 50))}</text>
      <text fg={rgba(props.t().textMuted)}>/help</text>
    </box>
  );
}

function Toast(props: { text: () => string; t: () => ThemeTokens }) {
  return (
    <box position="absolute" bottom={3} left={2} zIndex={50} backgroundColor={rgba(props.t().backgroundPanel)}>
      <text fg={rgba(props.t().secondary)}>
        {` ${props.text()} `}
      </text>
    </box>
  );
}

function Dialog(props: {
  type: ModalType | null; items: () => SelectItem[]; selectedIndex: () => number;
  inputValue: () => string; infoTitle: () => string; infoLines: () => string[];
  t: () => ThemeTokens; w: () => number; app: App; deps: TUIDeps;
  onClose: () => void; onSelect: (index: number, option: any) => void;
  onInputValueChange: Setter<string>; onSelectedIndexChange: Setter<number>;
}) {
  const modalW = () => Math.min(70, Math.floor(props.w() * 0.7));

  useKeyboard((key) => {
    if (key.name === "escape") { props.onClose(); return; }
    if (!props.type) return;

    if (props.type === "apiKeyPrompt" || props.type === "soulEditor") {
      if (key.name === "return") {
        const val = props.inputValue();
        if (props.type === "apiKeyPrompt" && val.trim()) {
          try { props.deps.llmProvider?.setApiKey?.(props.app.modal.pendingAction ?? "", val.trim()); props.onClose(); }
          catch { /* ignore */ }
        }
        if (props.type === "soulEditor") {
          try { props.deps.llmProvider?.setSoul?.(val); props.onClose(); }
          catch { /* ignore */ }
        }
        return;
      }
      if (key.name === "backspace") { props.onInputValueChange(val => val.slice(0, -1)); return; }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl) {
        props.onInputValueChange(val => val + key.sequence);
        return;
      }
      return;
    }

    if (props.type === "help" || props.type === "info" || props.type === "doctor") {
      if (key.name === "up") { /* scroll up */ return; }
      if (key.name === "down") { /* scroll down */ return; }
      if (key.sequence === "q") { props.onClose(); return; }
      return;
    }

    if (props.type === "themePicker") {
      if (key.name === "up") { props.onSelectedIndexChange(i => Math.max(0, i - 1)); return; }
      if (key.name === "down") { props.onSelectedIndexChange(i => Math.min(THEMES.length - 1, i + 1)); return; }
      if (key.name === "return") { props.onSelect(props.selectedIndex(), null); return; }
      return;
    }

    const items = props.items();
    if (key.name === "up") { props.onSelectedIndexChange(i => Math.max(0, i - 1)); return; }
    if (key.name === "down") { props.onSelectedIndexChange(i => Math.min(items.length - 1, i + 1)); return; }
    if (key.name === "return" && items.length > 0) { props.onSelect(props.selectedIndex(), items[props.selectedIndex()]); return; }
  });

  const titles: Record<string, string> = {
    modelPicker: "Select Model", providerPicker: "Select Provider", connectPicker: "Select Integration",
    skillBrowser: `Skills`, sessionBrowser: `Sessions`,
    memoryEditor: "Memory", memoryMenu: "Memory", memorySystemPicker: "Memory System",
    scheduleBrowser: "Schedule", coderPicker: "Coder Backend",
    searchModePicker: "Search Mode", browserModePicker: "Browser Mode",
    checkpointBrowser: "Checkpoints", apiKeyPrompt: "API Key", soulEditor: "Soul",
  };

  return (
    <box position="absolute" top={2} left={Math.floor((props.w() - modalW()) / 2)} zIndex={200}
      width={modalW()} flexDirection="column" backgroundColor={rgba(props.t().backgroundPanel)}
      border={true} borderColor={rgba(props.t().border)}>
      <text height={1} fg={rgba(props.t().primary)}>
        {titles[props.type ?? ""] ?? "Select"}
      </text>

      <SafeShow when={props.type === "help"}>
        <HelpContent t={props.t} w={modalW} />
      </SafeShow>

      <SafeShow when={props.type === "info" || props.type === "doctor"}>
        <InfoContent title={props.infoTitle} lines={props.infoLines} t={props.t} w={modalW} />
      </SafeShow>

      <SafeShow when={props.type === "apiKeyPrompt"}>
        <ApiKeyContent target={props.app.modal.pendingAction ?? ""} inputValue={props.inputValue} t={props.t} w={modalW} />
      </SafeShow>

      <SafeShow when={props.type === "soulEditor"}>
        <SoulContent inputValue={props.inputValue} t={props.t} w={modalW} />
      </SafeShow>

      <SafeShow when={props.type === "themePicker"}>
        <ThemeContent selectedIndex={props.selectedIndex} themeName={() => props.app.themeName} t={props.t} w={modalW} />
      </SafeShow>

      <SafeShow when={props.type !== "help" && props.type !== "info" && props.type !== "doctor" && props.type !== "apiKeyPrompt" && props.type !== "soulEditor" && props.type !== "themePicker"}>
        <PickerContent items={props.items} selectedIndex={props.selectedIndex} t={props.t} w={modalW} />
      </SafeShow>
    </box>
  );
}

function HelpContent(props: { t: () => ThemeTokens; w: () => number }) {
  const cats = [
    { name: "General", cmds: [["/help", "Show help"], ["/exit", "Quit"], ["/status", "Status"], ["/clear", "Clear"], ["/reset", "Reset"]] },
    { name: "Agent", cmds: [["/models", "Select model"], ["/provider", "Provider"], ["/soul", "Personality"]] },
    { name: "Tools", cmds: [["/skills", "Skills"], ["/memory", "Memory"], ["/connect", "Integrations"]] },
    { name: "Other", cmds: [["/themes", "Themes"], ["/browser", "Browser"], ["/doctor", "Diagnostics"]] },
  ];

  return (
    <box flexDirection="column">
      <For each={cats}>
        {(cat) => (
          <box flexDirection="column">
            <text height={1} fg={rgba(props.t().info)}>{`  ${cat.name}`}</text>
            <For each={cat.cmds}>
              {([cmd, desc]) => (
                <text height={1} fg={rgba(props.t().textMuted)}>{`    ${cmd.padEnd(20)} ${desc}`}</text>
              )}
            </For>
          </box>
        )}
      </For>
      <text height={1} fg={rgba(props.t().textMuted)}>Esc/q to close</text>
    </box>
  );
}

function InfoContent(props: { title: () => string; lines: () => string[]; t: () => ThemeTokens; w: () => number }) {
  return (
    <box flexDirection="column">
      <For each={props.lines().slice(0, 20)}>
        {(line) => {
          let fg = props.t().text;
          if (line.startsWith("##") || line.startsWith("─")) fg = props.t().secondary;
          else if (line.startsWith("✓") || line.startsWith("✔")) fg = props.t().success;
          else if (line.startsWith("✗") || line.startsWith("✘")) fg = props.t().error;
          else if (line.startsWith("⚠")) fg = props.t().warning;
          return <text height={1} fg={rgba(fg)}>{truncateStr(line, props.w() - 4)}</text>;
        }}
      </For>
      <text height={1} fg={rgba(props.t().textMuted)}>Esc/q to close · ↑↓ scroll</text>
    </box>
  );
}

function ApiKeyContent(props: { target: string; inputValue: () => string; t: () => ThemeTokens; w: () => number }) {
  return (
    <box flexDirection="column">
      <text height={1} fg={rgba(props.t().text)}>{`Enter API key for ${props.target}:`}</text>
      <text height={1} fg={rgba(props.inputValue() ? props.t().text : props.t().textMuted)}>
        {`> ${props.inputValue() ? "•".repeat(16) : "sk-..."}`}
      </text>
      <text height={1} fg={rgba(props.t().textMuted)}>Enter confirm · Esc cancel</text>
    </box>
  );
}

function SoulContent(props: { inputValue: () => string; t: () => ThemeTokens; w: () => number }) {
  return (
    <box flexDirection="column">
      <SafeShow when={props.inputValue()} fallback={
        <text height={1} fg={rgba(props.t().textMuted)}>  Default personality active</text>
      }>
        <For each={props.inputValue().split("\n").slice(0, 5)}>
          {(line) => <text height={1} fg={rgba(props.t().text)}>{`  ${truncateStr(line, props.w() - 6)}`}</text>}
        </For>
      </SafeShow>
      <text height={1} fg={rgba(props.t().textMuted)}>Enter save · Esc cancel</text>
    </box>
  );
}

function ThemeContent(props: { selectedIndex: () => number; themeName: () => string; t: () => ThemeTokens; w: () => number }) {
  return (
    <box flexDirection="column">
      <For each={THEMES}>
        {(th, i) => {
          const isCurrent = () => th.name === props.themeName();
          const isSel = () => i() === props.selectedIndex();
          return (
            <box height={1} backgroundColor={rgba(isSel() ? props.t().backgroundElement : props.t().background)}>
              <text height={1}
                fg={rgba(isSel() ? props.t().primary : isCurrent() ? props.t().primary : props.t().textMuted)}
              >
                {`${isCurrent() ? "◆ " : "  "}${th.name}  ████████`}
              </text>
            </box>
          );
        }}
      </For>
      <text height={1} fg={rgba(props.t().textMuted)}>↑↓ preview · Enter save · Esc restore</text>
    </box>
  );
}

function PickerContent(props: { items: () => SelectItem[]; selectedIndex: () => number; t: () => ThemeTokens; w: () => number }) {
  return (
    <box flexDirection="column">
      <For each={props.items().slice(0, 12)}>
        {(item, i) => {
          const isSel = () => i() === props.selectedIndex();
          return (
            <box height={1} backgroundColor={rgba(isSel() ? props.t().backgroundElement : props.t().background)}>
              <text height={1}
                fg={rgba(isSel() ? props.t().primary : props.t().text)}
              >
                {`${isSel() ? "▸ " : "  "}${truncateStr(item.label, props.w() - 8)}`}
              </text>
            </box>
          );
        }}
      </For>
      <SafeShow when={props.items().length > 0}>
        <text height={1} fg={rgba(props.t().textMuted)}>↑↓ navigate · Enter select · Esc close</text>
      </SafeShow>
    </box>
  );
}
