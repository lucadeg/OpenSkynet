/**
 * Electron Server Module
 *
 * This module provides specialized agent functionality for the Electron app,
 * focusing on browser automation, document processing, and computer control.
 *
 * Main exports:
 * - ElectronAgent: Specialized agent for browser/computer automation
 * - registerElectronTools: Tool registration for Electron agent
 * - createElectronAgent: Factory function to create a configured agent
 */

export { ElectronAgent } from "./agent/ElectronAgent";
export type { ElectronAgentOpts, ElectronTaskCategory } from "./agent/ElectronAgent";

export { registerElectronTools } from "./tools/electron-tools";
export type { ElectronToolsOpts } from "./tools/electron-tools";

import { ElectronAgent } from "./agent/ElectronAgent";
import { ToolBus } from "../agent/tools/bus";
import { registerElectronTools } from "./tools/electron-tools";

/**
 * Create a configured ElectronAgent with all tools registered
 */
export interface CreateElectronAgentConfig {
  llmProvider: import("../llm/provider").LLMProvider;
  memory?: import("../memory/strategy").BaseMemoryStrategy;
  skillEngine?: import("../skills/engine").SkillEngine;
  enableBrowserTools?: boolean;
  enableDocumentTools?: boolean;
  enableFileTools?: boolean;
  headless?: boolean;
}

export function createElectronAgent(config: CreateElectronAgentConfig): ElectronAgent {
  // Create tool bus
  const toolBus = new ToolBus();

  // Register Electron-specific tools
  registerElectronTools(toolBus, {
    enableBrowserTools: config.enableBrowserTools,
    enableDocumentTools: config.enableDocumentTools,
    enableFileTools: config.enableFileTools,
  });

  // Create and return the agent
  return new ElectronAgent({
    llmProvider: config.llmProvider,
    memory: config.memory,
    skillEngine: config.skillEngine,
    toolBus,
    headless: config.headless,
  });
}

/**
 * Convenience function to run a task with the Electron agent
 */
export async function runElectronTask(
  task: string,
  config: CreateElectronAgentConfig
): Promise<import("../core/types").AgentResult> {
  const agent = createElectronAgent(config);
  return agent.run(task);
}
