/**
 * Coding Agent - Specialized agent for code editing tasks.
 *
 * Provides project-aware code editing with:
 * - Automatic project discovery
 * - Pre/post execution hooks
 * - Inline verification
 * - Conversation history
 * - Tool-based file operations
 */

export { CodingAgent, createCodingAgent } from "./agent";
export { discoverProject, getProjectSummary } from "./context";
export {
  DefaultHookPipeline,
  createDefaultPipeline,
  syntaxValidationHook,
  fileSafetyHook,
  testGenerationHook,
} from "./hooks";
export { createCodingToolRegistry } from "./tools";
export { InlineVerifier, verifyEdits } from "./verifier";
export { buildSystemPrompt, buildTaskPrompt, buildVerificationPrompt } from "./prompts";

export type {
  ProjectInfo,
  CodingResult,
  FileEdit,
  EditOperation,
  VerificationResult,
  HookContext,
  PreHookResult,
  PostHookResult,
  HookPipeline,
  CodingAgentConfig,
} from "./types";
