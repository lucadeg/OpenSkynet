/**
 * OpenSkynet Agent System
 *
 * Primary agent:
 * - BrowserAgent: Browser-first agent with comprehensive tools
 *
 * Core infrastructure:
 * - AgentLoop: Core execution loop
 * - ToolBus: Tool registration and execution
 * - Monitoring: Budget, audit, safety
 *
 * Legacy (kept for compatibility):
 * - CheckpointManager, ContextCompressor, ProgressTracker
 * - Soul, prompts, locales
 * - Skills system
 */

// Primary agent
export { BrowserAgent } from './BrowserAgent';
export type { BrowserAgentOpts } from './BrowserAgent';

// Core infrastructure
export { AgentContext } from "./core/base";
export { AgentConfig, DEFAULT_AGENT_CONFIG } from "./core/types";
export {
  AgentState,
  createInitialState,
  transitionPhase,
  addObservation,
  addReflection,
  addPlanStep,
} from "./core/state";
export { InterruptSignal, AgentInterruptedError } from "./core/interrupt";

// Monitoring and safety
export {
  AuditLog,
  SharedScratchpad,
  assessRisk,
  checkBudget,
} from "./monitoring/guardrails";
export type { Budget, RiskAssessment, AuditEntry } from "./monitoring/guardrails";
export { ContextCompressor } from "./memory/compressor";

// Progress tracking
export {
  ProgressTracker,
  generateMilestonesPrompt,
  parseMilestones,
} from "./memory/progress";
export type { Milestone } from "./memory/progress";

// Checkpoint management
export { CheckpointManager } from "./memory/checkpoint";
export type { Checkpoint } from "./memory/checkpoint";

// Prompts and personality
export { loadSoul, saveSoul, getDefaultSoul } from "./prompts/soul";
export { ContainerManager } from "./utils/container";

// Locales
export {
  SCHEDULE_KEYWORDS,
  CHAT_KEYWORDS,
  ACTION_VERBS,
} from "./prompts/locales";

// Skills
export { SkillAuditor } from "./skills/skill-auditor";
export { SkillLearnerAgent as SkillLearner } from "./skills/skill-learner";
export { TraceToSkill as traceToSkill } from "./skills/trace-to-skill";
