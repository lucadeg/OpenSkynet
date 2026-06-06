/**
 * Hooks pipeline for the Coding Agent.
 * Allows pre and post-execution hooks to modify behavior.
 */

import type {
  HookContext,
  HookPipeline,
  PreHookResult,
  PostHookResult,
} from "./types";

export class DefaultHookPipeline implements HookPipeline {
  name: string;
  preHooks: Array<(context: HookContext) => Promise<PreHookResult>> = [];
  postHooks: Array<(context: HookContext, result: any) => Promise<PostHookResult>> = [];

  constructor(name: string = "default") {
    this.name = name;
  }

  registerPreHook(hook: (context: HookContext) => Promise<PreHookResult>): void {
    this.preHooks.push(hook);
  }

  registerPostHook(hook: (context: HookContext, result: any) => Promise<PostHookResult>): void {
    this.postHooks.push(hook);
  }

  async executePreHooks(context: HookContext): Promise<PreHookResult> {
    let finalResult: PreHookResult = { continue: true };

    for (const hook of this.preHooks) {
      try {
        const result = await hook(context);
        if (!result.continue) {
          return result;
        }
        if (result.modifications) {
          finalResult.modifications = { ...finalResult.modifications, ...result.modifications };
        }
      } catch (err) {
        console.error("Pre-hook error:", err);
        // Continue execution despite hook errors
      }
    }

    return finalResult;
  }

  async executePostHooks(context: HookContext, result: any): Promise<PostHookResult> {
    for (const hook of this.postHooks) {
      try {
        const hookResult = await hook(context, result);
        if (hookResult.status === "failure") {
          return hookResult;
        }
        if (hookResult.additionalEdits) {
          result.edits.push(...hookResult.additionalEdits);
        }
      } catch (err) {
        console.error("Post-hook error:", err);
        // Continue despite hook errors
      }
    }

    return { status: "success" };
  }
}

export function createDefaultPipeline(): HookPipeline {
  const pipeline = new DefaultHookPipeline();

  // Register some useful default hooks

  // Pre-hook: Validate task description
  pipeline.registerPreHook(async (context: HookContext) => {
    const { task } = context;

    if (!task || task.trim().length === 0) {
      return {
        continue: false,
      };
    }

    if (task.length < 10) {
      return {
        continue: true,
        modifications: {
          task: `Please help with: ${task}`,
        },
      };
    }

    return { continue: true };
  });

  // Pre-hook: Detect and add relevant files
  pipeline.registerPreHook(async (context: HookContext) => {
    // This would be enhanced with actual file detection
    const { project } = context;

    if (project.language === "typescript" || project.language === "javascript") {
      // Add package.json, tsconfig.json if not already included
      const files = context.files || [];
      const importantFiles = ["package.json", "tsconfig.json", "README.md"];

      for (const file of importantFiles) {
        if (!files.includes(file)) {
          files.push(file);
        }
      }

      return {
        continue: true,
        modifications: { files },
      };
    }

    return { continue: true };
  });

  // Post-hook: Validate file edits
  pipeline.registerPostHook(async (_context: HookContext, result: any) => {
    const { edits } = result;

    if (!edits || edits.length === 0) {
      return {
        status: "partial",
        message: "No edits were made",
      };
    }

    // Check for syntax errors (simplified)
    const errors: string[] = [];
    for (const edit of edits) {
      if (!edit.newContent || edit.newContent.trim().length === 0) {
        errors.push(`Empty content in ${edit.path}`);
      }
    }

    if (errors.length > 0) {
      return {
        status: "failure",
        message: `Validation errors: ${errors.join(", ")}`,
      };
    }

    return { status: "success" };
  });

  return pipeline;
}

// Built-in hooks

export async function syntaxValidationHook(context: HookContext): Promise<PreHookResult> {
  // Check if the task contains valid syntax
  // This is a simplified check
  return { continue: true };
}

export async function fileSafetyHook(context: HookContext): Promise<PreHookResult> {
  // Prevent editing dangerous files
  const dangerousPatterns = [
    "/etc/passwd",
    "/etc/shadow",
    "~/.ssh",
    "key.pem",
    "private.key",
    ".env.local",
  ];

  for (const file of context.files || []) {
    for (const pattern of dangerousPatterns) {
      if (file.includes(pattern)) {
        return {
          continue: false,
        };
      }
    }
  }

  return { continue: true };
}

export async function testGenerationHook(
  context: HookContext,
  result: any
): Promise<PostHookResult> {
  // Suggest generating tests if edits were made
  if (result.edits && result.edits.length > 0) {
    return {
      status: "success",
      message: "Consider generating tests for the modified files",
    };
  }

  return { status: "success" };
}
