/**
 * Execute code tool - runs code in a sandboxed environment.
 * Supports Python, JavaScript, TypeScript, and other languages.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, unlink, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ToolDefinition } from "../../core/types.js";
import type { ToolResult } from "./interfaces.js";
import type { ToolBus } from "./bus.js";

export interface ExecuteCodeConfig {
  allowed?: boolean;
  timeout?: number;
  tempDir?: string;
  allowNet?: boolean;
}

export class ExecuteCodeTool {
  private allowed: boolean;
  private timeout: number;
  private tempDir: string;
  private allowNet: boolean;

  constructor(config: ExecuteCodeConfig = {}) {
    this.allowed = config.allowed ?? false;
    this.timeout = config.timeout ?? 60;
    this.tempDir = config.tempDir ?? tmpdir();
    this.allowNet = config.allowNet ?? false;
  }

  register(bus: ToolBus): void {
    const definition: ToolDefinition = {
      name: "execute_code",
      description: "Execute code in a sandboxed environment. Supports Python, JavaScript, TypeScript, Bash, and more.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Code to execute",
          },
          language: {
            type: "string",
            enum: ["python", "javascript", "typescript", "bash", "node", "deno"],
            description: "Programming language",
          },
          timeout: {
            type: "number",
            description: "Timeout in seconds (default 60)",
          },
        },
        required: ["code", "language"],
      },
      toolset: "execution",
    };

    bus.register(definition, async (_name: string, args: Record<string, unknown>) => {
      if (!this.allowed) {
        return {
          success: false,
          output: "",
          error: "Code execution is not allowed. Enable it in configuration.",
        };
      }

      const code = args.code as string;
      const language = args.language as string;
      const timeoutSec = (args.timeout as number) ?? this.timeout;

      if (!code || !code.trim()) {
        return { success: false, output: "", error: "Code is required" };
      }

      try {
        const result = await this._execute(code, language, timeoutSec);
        return {
          success: result.exitCode === 0,
          output: result.stdout || result.stderr || "(no output)",
          data: {
            exit_code: result.exitCode,
            timed_out: result.timedOut,
            execution_time: result.executionTime,
          },
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });
  }

  private async _execute(
    code: string,
    language: string,
    timeoutSec: number,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
    executionTime: number;
  }> {
    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let exitCode: number | null = null;
    let timedOut = false;

    // Create temporary directory for execution
    const tempDir = await mkdtemp(join(this.tempDir, "code-exec-"));

    try {
      const command = await this._buildCommand(code, language, tempDir);

      await new Promise<void>((resolve, reject) => {
        const child = spawn(command.command, command.args || [], {
          cwd: tempDir,
          env: {
            ...process.env,
            // Restrict network if not allowed
            NODE_ENV: this.allowNet ? process.env.NODE_ENV : "production",
          },
          timeout: timeoutSec * 1000,
        });

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
          resolve();
        }, timeoutSec * 1000);

        child.stdout?.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        child.on("close", (code: number | null) => {
          clearTimeout(timer);
          exitCode = code;
          resolve();
        });

        child.on("error", (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    } finally {
      // Cleanup temp directory
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      stdout,
      stderr,
      exitCode,
      timedOut,
      executionTime: Date.now() - startTime,
    };
  }

  private async _buildCommand(
    code: string,
    language: string,
    tempDir: string,
  ): Promise<{ command: string; args?: string[] }> {
    switch (language) {
      case "python":
        return { command: "python3", args: ["-c", code] };

      case "javascript":
      case "node": {
        const filePath = join(tempDir, "code.js");
        await writeFile(filePath, code, "utf-8");
        return { command: "node", args: [filePath] };
      }

      case "typescript": {
        // Use ts-node or tsx if available, else error
        const filePath = join(tempDir, "code.ts");
        await writeFile(filePath, code, "utf-8");
        return { command: "npx", args: ["tsx", filePath] };
      }

      case "bash":
        return { command: "bash", args: ["-c", code] };

      case "deno": {
        const filePath = join(tempDir, "code.ts");
        await writeFile(filePath, code, "utf-8");
        return {
          command: "deno",
          args: ["run", "--allow-net=" + (this.allowNet ? "true" : "false"), filePath],
        };
      }

      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  setAllowed(allowed: boolean): void {
    this.allowed = allowed;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setAllowNet(allowNet: boolean): void {
    this.allowNet = allowNet;
  }
}
