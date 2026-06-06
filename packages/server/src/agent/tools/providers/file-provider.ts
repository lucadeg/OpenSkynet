import { readFile, writeFile, readdir, mkdir, unlink, rename, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ToolDefinition } from "../../../core/types.js";
import type { ToolResult } from "../interfaces.js";
import type { ToolBus } from "../bus.js";

export class FileProvider {
  register(bus: ToolBus): void {
    const tools: Array<{ definition: ToolDefinition; executor: (name: string, args: Record<string, unknown>) => Promise<ToolResult> }> = [
      {
        definition: {
          name: "read_file",
          description: "Read the contents of a file",
          parameters: {
            type: "object",
            properties: { path: { type: "string", description: "File path to read" } },
            required: ["path"],
          },
          toolset: "file",
        },
        executor: async (_name, args) => {
          try {
            const content = await readFile(args.path as string, "utf-8");
            return { success: true, output: content };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "write_file",
          description: "Write content to a file",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path to write" },
              content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
          },
          toolset: "file",
        },
        executor: async (_name, args) => {
          try {
            await mkdir(dirname(args.path as string), { recursive: true });
            await writeFile(args.path as string, args.content as string, "utf-8");
            return { success: true, output: `Wrote to ${args.path}` };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "list_directory",
          description: "List files and directories in a path",
          parameters: {
            type: "object",
            properties: { path: { type: "string", description: "Directory path" } },
            required: ["path"],
          },
          toolset: "file",
        },
        executor: async (_name, args) => {
          try {
            const entries = await readdir(args.path as string, { withFileTypes: true });
            const lines = entries.map((e) => `${e.isDirectory() ? "d" : "f"} ${e.name}`);
            return { success: true, output: lines.join("\n") || "(empty)" };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "create_directory",
          description: "Create a directory (and parents)",
          parameters: {
            type: "object",
            properties: { path: { type: "string", description: "Directory path to create" } },
            required: ["path"],
          },
          toolset: "file",
        },
        executor: async (_name, args) => {
          try {
            await mkdir(args.path as string, { recursive: true });
            return { success: true, output: `Created directory ${args.path}` };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "delete_file",
          description: "Delete a file or empty directory",
          parameters: {
            type: "object",
            properties: { path: { type: "string", description: "Path to delete" } },
            required: ["path"],
          },
          toolset: "file",
        },
        executor: async (_name, args) => {
          try {
            const s = await stat(args.path as string);
            if (s.isDirectory()) {
              const { rmdir } = await import("node:fs/promises");
              await rmdir(args.path as string);
            } else {
              await unlink(args.path as string);
            }
            return { success: true, output: `Deleted ${args.path}` };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "move_file",
          description: "Move or rename a file",
          parameters: {
            type: "object",
            properties: {
              source: { type: "string", description: "Source path" },
              destination: { type: "string", description: "Destination path" },
            },
            required: ["source", "destination"],
          },
          toolset: "file",
        },
        executor: async (_name, args) => {
          try {
            await mkdir(dirname(args.destination as string), { recursive: true });
            await rename(args.source as string, args.destination as string);
            return { success: true, output: `Moved ${args.source} to ${args.destination}` };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
      {
        definition: {
          name: "search_files",
          description: "Search for files matching a pattern under a directory",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "Root directory to search" },
              pattern: { type: "string", description: "Glob pattern or substring to match" },
            },
            required: ["path", "pattern"],
          },
          toolset: "file",
        },
        executor: async (_name, args) => {
          try {
            const { glob } = await import("node:fs/promises");
            const { resolve } = await import("node:path");
            const root = args.path as string;
            const pat = args.pattern as string;
            const matches: string[] = [];
            async function walk(dir: string): Promise<void> {
              const entries = await readdir(dir, { withFileTypes: true });
              for (const entry of entries) {
                const full = join(dir, entry.name);
                if (entry.name.toLowerCase().includes(pat.toLowerCase())) {
                  matches.push(full);
                }
                if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                  await walk(full);
                }
              }
            }
            await walk(root);
            return { success: true, output: matches.join("\n") || "No matches found" };
          } catch (err: unknown) {
            return { success: false, output: "", error: (err as Error).message };
          }
        },
      },
    ];

    for (const t of tools) {
      bus.register(t.definition, t.executor);
    }
  }
}
