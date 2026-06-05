/**
 * System prompt builder for the Coding Agent.
 * Constructs project-specific prompts with context and instructions.
 */

import type { ProjectInfo } from "./types";
import { getProjectSummary } from "./context";

export interface CodingPromptOptions {
  project?: ProjectInfo;
  task?: string;
  files?: string[];
  conversationHistory?: Array<{ role: string; content: string }>;
  additionalContext?: string;
  enableVerification?: boolean;
  systemPromptOverride?: string;
}

export function buildSystemPrompt(options: CodingPromptOptions = {}): string {
  const {
    project,
    task,
    files,
    conversationHistory,
    additionalContext,
    enableVerification = true,
    systemPromptOverride,
  } = options;

  if (systemPromptOverride) {
    return systemPromptOverride;
  }

  const sections: string[] = [];

  // Core identity and purpose
  sections.push(`You are an expert coding agent with access to file operations, code execution, and project tools.

Your role is to help users with coding tasks by:
1. Understanding their request and the project context
2. Reading and analyzing relevant files
3. Making precise, targeted edits
4. Verifying changes work correctly
5. Explaining your actions clearly`);

  // Project context
  if (project) {
    sections.push(`\n## Project Context`);
    sections.push(getProjectSummary(project));

    if (project.frameworks && project.frameworks.length > 0) {
      sections.push(`\nThis project uses: ${project.frameworks.join(", ")}`);
    }

    if (project.language) {
      sections.push(`\nPrimary language: ${project.language}`);
      sections.push(`Follow ${project.language} best practices and conventions.`);
    }

    if (project.testFramework) {
      sections.push(`\nTest framework: ${project.testFramework}`);
      sections.push(`When making changes, ensure tests pass.`);
    }
  }

  // Task context
  if (task) {
    sections.push(`\n## Current Task`);
    sections.push(task);
  }

  // File context
  if (files && files.length > 0) {
    sections.push(`\n## Relevant Files`);
    sections.push(`You have access to these files:`);
    for (const file of files) {
      sections.push(`- ${file}`);
    }
  }

  // Additional context
  if (additionalContext) {
    sections.push(`\n## Additional Context`);
    sections.push(additionalContext);
  }

  // Guidelines
  sections.push(`\n## Guidelines`);

  const guidelines = [
    "Make minimal, targeted changes to achieve the goal",
    "Preserve existing code style and formatting",
    "Add comments only when necessary to explain complex logic",
    "Ensure your edits don't break existing functionality",
    "Test your changes when appropriate",
    "Explain what you're doing and why",
  ];

  if (enableVerification) {
    guidelines.push("After making edits, verify syntax is correct");
  }

  sections.push(guidelines.map((g, i) => `${i + 1}. ${g}`).join("\n"));

  // Tools available
  sections.push(`\n## Available Tools`);
  sections.push(`You have access to:
- read_file: Read file contents
- write_file: Write or overwrite files
- edit_file: Edit specific lines in a file
- search_files: Find files by pattern
- run_tests: Execute the test suite
- run_command: Run shell commands
- find_references: Locate symbol references
- list_dependencies: Show project dependencies

Use tools judiciously. Read files before editing them.`);

  // Conversation history
  if (conversationHistory && conversationHistory.length > 0) {
    sections.push(`\n## Conversation History`);
    for (const msg of conversationHistory.slice(-5)) { // Last 5 messages
      sections.push(`${msg.role}: ${msg.content.slice(0, 200)}${msg.content.length > 200 ? "..." : ""}`);
    }
  }

  sections.push(`\nRemember: Be precise, be helpful, and explain your reasoning.`);

  return sections.join("\n");
}

export function buildTaskPrompt(task: string, context?: {
  fileContents?: Record<string, string>;
  error?: string;
  previousAttempts?: number;
}): string {
  const sections: string[] = [];

  sections.push(`Task: ${task}`);

  if (context?.fileContents) {
    sections.push(`\n## File Contents`);
    for (const [path, content] of Object.entries(context.fileContents)) {
      const preview = content.length > 500
        ? content.slice(0, 500) + "\n... (truncated)"
        : content;
      sections.push(`\n### ${path}\n\`\`\`\n${preview}\n\`\`\``);
    }
  }

  if (context?.error) {
    sections.push(`\n## Previous Error`);
    sections.push(context.error);
    sections.push(`\nPlease fix this issue.`);
  }

  if (context?.previousAttempts) {
    sections.push(`\n## Attempt ${context.previousAttempts + 1}`);
    sections.push(`Previous attempts: ${context.previousAttempts}`);
    sections.push(`Take a different approach if needed.`);
  }

  return sections.join("\n");
}

export function buildVerificationPrompt(edits: Array<{
  path: string;
  content: string;
}>): string {
  const sections: string[] = [];

  sections.push("Verify the following code edits for correctness:");
  sections.push("");

  for (const edit of edits) {
    sections.push(`## ${edit.path}`);
    sections.push("```");
    sections.push(edit.content);
    sections.push("```");
    sections.push("");
  }

  sections.push("Check for:");
  sections.push("- Syntax errors");
  sections.push("- Type errors (if applicable)");
  sections.push("- Logic errors");
  sections.push("- Security vulnerabilities");
  sections.push("- Performance issues");
  sections.push("");
  sections.push("Report any issues found, or confirm if the code looks correct.");

  return sections.join("\n");
}
