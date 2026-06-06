/**
 * Electron Tools - Browser-focused tool collection
 *
 * Based on kimi-code's tool system with proper:
 * - BuiltinTool classes
 * - ToolManager for registration
 * - ExecutableTool interface
 * - Display metadata
 */

export { BrowserTool } from './browser-tool';
export { ShellTool } from './shell-tool';

export * from '../tooling/types';
export * from '../tooling/tool-access';
export * from '../tooling/result-builder';

import { BrowserTool } from './browser-tool';
import { ShellTool } from './shell-tool';
import type { BuiltinTool } from '../tooling/types';
import type { ToolBus } from '../../agent/tools/bus';

/**
 * Initialize all Electron tools and register them to ToolBus
 *
 * This follows kimi-code's pattern of:
 * - Tool classes with resolveExecution
 * - Proper tool registration
 * - Display metadata for UI
 * - Resource tracking via ToolAccesses
 */
export function initializeElectronTools(
  toolBus: ToolBus,
  options: {
    cwd?: string;
    enableShellTools?: boolean;
    enableBrowserTools?: boolean;
  } = {}
): void {
  const {
    cwd = process.cwd(),
    enableShellTools = true,
    enableBrowserTools = true,
  } = options;

  if (enableBrowserTools) {
    const browserTool = new BrowserTool();
    registerToolToToolBus(toolBus, browserTool);
  }

  if (enableShellTools) {
    const shellTool = new ShellTool(cwd);
    registerToolToToolBus(toolBus, shellTool);
  }
}

/**
 * Register a BuiltinTool to ToolBus (bridges kimi-code style to our ToolBus)
 */
function registerToolToToolBus(
  toolBus: ToolBus,
  builtinTool: BuiltinTool<unknown>
): void {
  toolBus.register(builtinTool.name, {
    description: builtinTool.description,
    parameters: builtinTool.parameters,
    execute: async (args) => {
      const execution = await builtinTool.resolveExecution(args);

      // Check if execution failed at resolve time
      if ('isError' in execution && execution.isError) {
        return {
          success: false,
          output: execution.output,
          error: typeof execution.output === 'string' ? execution.output : 'Tool resolution failed'
        };
      }

      // Execute the tool
      try {
        const result = await execution.execute({
          turnId: 'electron-turn',
          toolCallId: Date.now().toString(),
          signal: new AbortController().signal
        });

        if (result.isError) {
          return {
            success: false,
            output: result.output,
            error: typeof result.output === 'string' ? result.output : 'Tool execution failed'
          };
        }

        return {
          success: true,
          output: result.output
        };
      } catch (error) {
        return {
          success: false,
          output: error instanceof Error ? error.message : String(error),
          error: error instanceof Error ? error.message : 'Tool execution failed'
        };
      }
    }
  });
}
