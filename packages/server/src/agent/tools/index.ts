export { ToolBus } from "./bus.js";
export { MemoryCache, NoOpCache } from "./cache.js";
export { ToolMetricsCollector } from "./metrics.js";
export { DefaultToolValidator } from "./validator.js";
export { createToolBus, createMinimalToolBus, createPerformanceToolBus } from "./factory.js";
export { FileProvider } from "./providers/file-provider.js";
export { TerminalProvider } from "./providers/terminal-provider.js";
export { WebProvider } from "./providers/web-provider.js";
export { MediaProvider } from "./providers/media-provider.js";
export { SkillsProvider } from "./providers/skills-provider.js";
export { MiscProvider } from "./providers/misc-provider.js";
export { ExecuteCodeTool } from "./execute-code.js";
export { MessagingTool, type MessagingConfig, type MessagingIntegration } from "./messaging.js";
export { OrchestrateTool } from "./orchestrate.js";
export type { ToolResult, ToolProvider, ToolExecutor } from "./interfaces.js";

import { ToolBus } from "./bus.js";
import { FileProvider } from "./providers/file-provider.js";
import { TerminalProvider } from "./providers/terminal-provider.js";
import { WebProvider } from "./providers/web-provider.js";
import { MediaProvider } from "./providers/media-provider.js";
import { SkillsProvider } from "./providers/skills-provider.js";
import { MiscProvider } from "./providers/misc-provider.js";

export function createAgentToolRegistry(opts?: {
  terminalAllowed?: boolean;
  memoryManager?: unknown;
  skillEngine?: unknown;
}): ToolBus {
  const bus = new ToolBus();

  new FileProvider().register(bus);
  new TerminalProvider(opts?.terminalAllowed ?? false).register(bus);
  new WebProvider().register(bus);
  new MediaProvider().register(bus);
  new SkillsProvider(opts?.skillEngine).register(bus);
  new MiscProvider(opts?.memoryManager).register(bus);

  return bus;
}
