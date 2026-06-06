import { z } from "zod";

// ── Enums (const objects + string literal unions) ──

export const MemoryTarget = {
  memory: "memory",
  user: "user",
} as const;
export type MemoryTarget = (typeof MemoryTarget)[keyof typeof MemoryTarget];

export const MemoryType = {
  fact: "fact",
  procedure: "procedure",
  episodic: "episodic",
  preference: "preference",
} as const;
export type MemoryType = (typeof MemoryType)[keyof typeof MemoryType];

export const AgentPhase = {
  planning: "planning",
  executing: "executing",
  observing: "observing",
  reflecting: "reflecting",
  done: "done",
  failed: "failed",
} as const;
export type AgentPhase = (typeof AgentPhase)[keyof typeof AgentPhase];

export const Strategy = {
  direct: "direct",
  use_skill: "use_skill",
  delegate: "delegate",
  decompose: "decompose",
} as const;
export type Strategy = (typeof Strategy)[keyof typeof Strategy];

// ── Core types ──

export interface BrowserResult {
  url: string;
  title: string;
  content: string;
  screenshot?: string;
  success: boolean;
  error?: string;
}

export interface StepEvent {
  phase: string;
  action: string;
  detail?: string;
  observation?: string;
  url?: string;
  screenshot?: string;
}

export interface AgentResult {
  task: string;
  result: string;
  success: boolean;
  steps: StepEvent[];
  skill_created?: string;
  scheduled_job_id?: string;
  schedule_cron?: string;
  actions_taken: string[];
  iterations: number;
  strategy_used: string;
  elapsed_secs: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  text: string | null;
  tool_calls: ToolCall[];
  done: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  toolset?: string;
}

export interface MemoryEntry {
  id?: string;
  content: string;
  target: MemoryTarget;
  type: MemoryType;
  source?: string;
  created_at?: string;
  updated_at?: string;
  score?: number;
}

export interface SkillStep {
  description: string;
  action_type?: string;
  url?: string;
  selector?: string;
  text?: string;
}

export interface SkillData {
  name: string;
  description: string;
  steps: string[];
  category?: string;
  version: number;
  variables?: string[];
  when_to_use?: string;
  pitfalls?: string[];
  verification?: string;
  structured_steps?: SkillStep[];
}

export interface CronJob {
  id: string;
  task: string;
  cron_expr: string;
  skill_name?: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
}

export interface SessionInfo {
  id: string;
  task: string;
  created_at: string;
  result?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  userDataDir: string;
  headless: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectConversation {
  id: string;
  projectId: string;
  task: string;
  stepsJson: string;
  result?: string;
  agentMode: string;
  createdAt: string;
}

export interface ProjectConfig {
  name: string;
  description?: string;
  headless?: boolean;
}

export interface ServerStatus {
  running: boolean;
  uptime_secs: number;
  browser_open: boolean;
  tasks_completed: number;
}

export interface SkillSearchResult {
  name: string;
  description: string;
  score: number;
  category?: string;
  source?: string;
}

export interface HubSkill {
  name: string;
  description: string;
  category: string;
  author: string;
  version: number;
  trust: string;
  installed: boolean;
  scope: string;
}

export interface ProviderInfo {
  name: string;
  default_model: string;
  default_base_url?: string;
  category: string;
  needs_api_key: boolean;
  has_key: boolean;
  auto_detect: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

export interface Observation {
  phase: string;
  action: string;
  result?: string;
  error?: string;
  url?: string;
}

export interface Reflection {
  success: boolean;
  analysis: string;
  recovery_hint?: string;
}

export interface PlanStep {
  index: number;
  description: string;
  strategy: Strategy;
  status: "pending" | "in_progress" | "done" | "failed";
}

export interface MessageEvent {
  channel_id: string;
  channel_name?: string;
  user_id: string;
  user_name: string;
  content: string;
  platform: string;
  is_command?: boolean;
  timestamp: string;
}

// ── RPC types ──

export interface RPCRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params: Record<string, unknown>;
}

export interface RPCResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface RPCNotification {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
}

// ── Zod schemas ──

export const StepEventSchema = z.object({
  phase: z.string(),
  action: z.string(),
  detail: z.string().optional(),
  observation: z.string().optional(),
  url: z.string().optional(),
  screenshot: z.string().optional(),
});

export const AgentResultSchema = z.object({
  task: z.string(),
  result: z.string(),
  success: z.boolean(),
  steps: z.array(StepEventSchema),
  skill_created: z.string().optional(),
  scheduled_job_id: z.string().optional(),
  schedule_cron: z.string().optional(),
  actions_taken: z.array(z.string()),
  iterations: z.number(),
  strategy_used: z.string(),
  elapsed_secs: z.number(),
});

export const SkillStepSchema = z.object({
  description: z.string(),
  action_type: z.string().optional(),
  url: z.string().optional(),
  selector: z.string().optional(),
  text: z.string().optional(),
});

export const SkillDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  steps: z.array(z.string()),
  category: z.string().optional(),
  version: z.number(),
  variables: z.array(z.string()).optional(),
  when_to_use: z.string().optional(),
  pitfalls: z.array(z.string()).optional(),
  verification: z.string().optional(),
  structured_steps: z.array(SkillStepSchema).optional(),
});

export const CronJobSchema = z.object({
  id: z.string(),
  task: z.string(),
  cron_expr: z.string(),
  skill_name: z.string().optional(),
  enabled: z.boolean(),
  last_run: z.string().optional(),
  next_run: z.string().optional(),
});

export const RPCRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string()]),
  method: z.string(),
  params: z.record(z.unknown()),
});

export const RPCResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string(), z.null()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});
