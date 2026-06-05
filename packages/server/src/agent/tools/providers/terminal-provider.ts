import { spawn } from "node:child_process";
import type { ToolDefinition } from "../../../core/types.js";
import type { ToolResult } from "../interfaces.js";
import type { ToolBus } from "../bus.js";

export class TerminalProvider {
  private allowed: boolean;

  constructor(allowed = false) {
    this.allowed = allowed;
  }

  register(bus: ToolBus): void {
    const definition: ToolDefinition = {
      name: "run_command",
      description: "Execute a shell command and return its output",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to run" },
          timeout: { type: "number", description: "Timeout in seconds (default 30)" },
          cwd: { type: "string", description: "Working directory" },
        },
        required: ["command"],
      },
      toolset: "terminal",
    };

    bus.register(definition, async (_name: string, args: Record<string, unknown>) => {
      if (!this.allowed) {
        return { success: false, output: "", error: "Terminal commands are not allowed" };
      }

      const command = args.command as string;
      const timeoutSec = (args.timeout as number) ?? 30;
      const cwd = (args.cwd as string) ?? process.cwd();

      return new Promise<ToolResult>((resolve) => {
        let stdout = "";
        let stderr = "";

        const child = spawn("sh", ["-c", command], { cwd, env: process.env as Record<string, string> });

        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve({ success: false, output: stdout, error: `Command timed out after ${timeoutSec}s` });
        }, timeoutSec * 1000);

        child.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        child.on("close", (code: number | null) => {
          clearTimeout(timer);
          const output = stdout + (stderr ? `\n[stderr]\n${stderr}` : "");
          if (code === 0) {
            resolve({ success: true, output: output || "(no output)" });
          } else {
            resolve({ success: false, output, error: `Exit code: ${code}` });
          }
        });

        child.on("error", (err: Error) => {
          clearTimeout(timer);
          resolve({ success: false, output: "", error: err.message });
        });
      });
    });
  }
}
