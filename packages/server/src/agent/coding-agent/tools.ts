/**
 * Coding-specific tool registry for the Coding Agent.
 * Provides file operations, code execution, and project tools.
 */

import type { ToolDefinition, ToolBus } from "../tools/interfaces";
import type { LLMProvider } from "../../llm/provider";

export function createCodingToolRegistry(llm: LLMProvider): ToolBus {
  // This would import and use ToolBus
  // For now, return a placeholder
  const tools: ToolDefinition[] = [
    {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
        },
        required: ["path"],
      },
      toolset: "file",
    },
    {
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
    {
      name: "edit_file",
      description: "Edit specific lines in a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to edit" },
          startLine: { type: "number", description: "Starting line number (1-based)" },
          endLine: { type: "number", description: "Ending line number (1-based)" },
          content: { type: "string", description: "New content for the specified lines" },
        },
        required: ["path", "startLine", "endLine", "content"],
      },
      toolset: "file",
    },
    {
      name: "search_files",
      description: "Search for files matching a pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Search pattern (supports glob)" },
          path: { type: "string", description: "Directory to search (default: current directory)" },
        },
        required: ["pattern"],
      },
      toolset: "file",
    },
    {
      name: "run_tests",
      description: "Run the project's test suite",
      parameters: {
        type: "object",
        properties: {
          testPath: { type: "string", description: "Specific test file or pattern to run" },
          args: { type: "string", description: "Additional arguments to pass to the test runner" },
        },
      },
      toolset: "test",
    },
    {
      name: "run_command",
      description: "Run a shell command in the project directory",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to run" },
        },
        required: ["command"],
      },
      toolset: "terminal",
    },
    {
      name: "find_references",
      description: "Find references to a symbol in the codebase",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol name to search for" },
          fileType: { type: "string", description: "File type to search (e.g., 'ts', 'py')" },
        },
        required: ["symbol"],
      },
      toolset: "code",
    },
    {
      name: "list_dependencies",
      description: "List project dependencies",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["all", "production", "dev"], description: "Dependency type to list" },
        },
      },
      toolset: "project",
    },
  ];

  // Return the tools array for now
  // In a full implementation, this would return a ToolBus with registered tools
  return tools as any;
}
