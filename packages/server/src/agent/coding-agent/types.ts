/**
 * Types for the Coding Agent system.
 */

export interface ProjectInfo {
  name?: string;
  root?: string;
  language?: string;
  packageManager?: string;
  buildSystem?: string;
  testFramework?: string;
  frameworks?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface CodingResult {
  success: boolean;
  edits: FileEdit[];
  errors: string[];
  verificationResults?: VerificationResult[];
  summary: string;
}

export interface FileEdit {
  path: string;
  originalContent: string;
  newContent: string;
  edits: EditOperation[];
}

export interface EditOperation {
  type: "insert" | "delete" | "replace";
  startLine: number;
  endLine: number;
  content?: string;
  description: string;
}

export interface VerificationResult {
  filePath: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface HookContext {
  project: ProjectInfo;
  task: string;
  files: string[];
  edits: FileEdit[];
  metadata: Record<string, unknown>;
}

export interface PreHookResult {
  continue: boolean;
  modifications?: {
    task?: string;
    files?: string[];
    context?: string;
  };
}

export interface PostHookResult {
  status: "success" | "failure" | "partial";
  message?: string;
  additionalEdits?: FileEdit[];
}

export interface HookPipeline {
  name: string;
  preHooks: Array<(context: HookContext) => Promise<PreHookResult>>;
  postHooks: Array<(context: HookContext, result: CodingResult) => Promise<PostHookResult>>;
  registerPreHook(hook: (context: HookContext) => Promise<PreHookResult>): void;
  registerPostHook(hook: (context: HookContext, result: CodingResult) => Promise<PostHookResult>): void;
  executePreHooks(context: HookContext): Promise<PreHookResult>;
  executePostHooks(context: HookContext, result: CodingResult): Promise<PostHookResult>;
}

export interface CodingAgentConfig {
  llm: LLMProvider;
  maxRounds?: number;
  maxConsecutiveErrors?: number;
  verifyAfterEdits?: boolean;
  enableHooks?: boolean;
  projectInfo?: ProjectInfo;
  autoDiscoverProject?: boolean;
  onStep?: (action: string, detail: string) => void;
  onStreamingText?: (text: string) => void;
  conversationHistory?: Array<{ role: string; content: string }>;
  systemPromptOverride?: string;
  hooks?: HookPipeline;
}

// Import LLMProvider from llm/provider
import type { LLMProvider } from "../../llm/provider.js";
