/**
 * Agent Module
 *
 * Organized exports for the agent system.
 *
 * Main agent:
 * - BrowserAgent from ../agent/BrowserAgent (browser-first with comprehensive tools)
 *
 * Available from this module:
 * - T800Agent: Direct execution agent with all tools
 * - Types and constants
 * - Utilities
 */

// Main browser-first agent (replaces ElectronAgent)
export { BrowserAgent } from '../../agent/BrowserAgent';
export type { BrowserAgentOpts } from '../../agent/BrowserAgent';

// T800Agent (direct execution, kept for reference)
export { T800Agent } from './T800Agent';
export type { T800AgentOpts } from './T800Agent';

// Types and constants
export * from './types';
export * from './constants';

// Utilities
export * from './utils/index';
