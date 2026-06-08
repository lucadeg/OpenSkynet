/**
 * Structured Response Parser
 *
 * Parses LLM responses with Zod schema validation
 * Handles JSON, markdown code blocks, and tag-based formats
 *
 * @module agent/schemas/parser
 */

import {
  AgentResponseSchema,
  AgentThoughtSchema,
  ToolCallSchema,
  coerceAgentResponse,
  validateAgentResponse,
  type AgentResponse,
  type ToolCall,
} from './agent-schemas';

// ============================================================================
// Parsed Response Types
// ============================================================================

export interface ParsedAgentResponse {
  thinking: string;
  evaluationPreviousGoal: string;
  memory: string;
  nextGoal: string;
  actions: Array<{ name: string; args: Record<string, unknown> }>;
  done: boolean;
  doneText: string;
  confidence?: number;
  estimatedRemainingSteps?: number;
}

// ============================================================================
// Tag Extraction Utilities
// ============================================================================

/**
 * Extract content from a tag in the format <tag>content</tag>
 */
function extractTag(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}\\s*([\\s\\S]*?)\\s*</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

/**
 * Extract all occurrences of a tag
 */
function extractAllTags(text: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}\\s*([\\s\\S]*?)\\s*</${tag}>`, 'gi');
  const matches = text.matchAll(regex);
  return Array.from(matches).map(m => m[1].trim());
}

/**
 * Extract summary from response
 */
function extractSummary(text: string): string {
  // Try <summary> tag first
  const summaryTag = extractTag(text, 'summary');
  if (summaryTag) return summaryTag;

  // Try <done> tag content
  const doneTag = extractTag(text, 'done');
  if (doneTag) return doneTag;

  // Look for patterns like "Summary:" or "Final result:"
  const summaryPatterns = [
    /summary:\s*([^\n]+)/i,
    /final result:\s*([^\n]+)/i,
    /conclusion:\s*([^\n]+)/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

/**
 * Extract JSON from markdown code blocks
 */
function extractJsonFromCodeBlocks(text: string): any | null {
  // Try ```json``` blocks
  const jsonCodeBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonCodeBlock) {
    try {
      return JSON.parse(jsonCodeBlock[1]);
    } catch {
      // Invalid JSON, continue
    }
  }

  // Try bare JSON at start of text
  const bareJson = text.match(/^\s*(\{[\s\S]*?\})\s*$/);
  if (bareJson) {
    try {
      return JSON.parse(bareJson[1]);
    } catch {
      // Invalid JSON, continue
    }
  }

  return null;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert AgentResponse to ParsedAgentResponse
 */
function fromAgentResponse(response: AgentResponse): ParsedAgentResponse {
  return {
    thinking: response.thought.thinking,
    evaluationPreviousGoal: response.thought.evaluation,
    memory: response.thought.memory,
    nextGoal: response.thought.nextGoal,
    actions: (response.actions || []).map(a => ({
      name: a.name,
      args: a.arguments || {},
    })),
    done: response.done,
    doneText: response.summary || '',
    confidence: response.confidence,
    estimatedRemainingSteps: response.estimatedRemainingSteps,
  };
}

/**
 * Parse with regex extraction and coerce to valid schema
 */
function parseWithCoercion(
  text: string,
  toolCalls?: ToolCall[]
): ParsedAgentResponse {
  // Extract tags using regex
  const thinking = extractTag(text, 'thinking');
  const evaluation = extractTag(text, 'evaluation');
  const memory = extractTag(text, 'memory');
  const nextGoal = extractTag(text, 'next_goal');
  const summary = extractSummary(text);

  // Determine if done
  const done =
    text.includes('<done>') ||
    text.includes('[DONE]') ||
    text.toLowerCase().includes('task complete') ||
    text.toLowerCase().includes('task completed');

  // Build agent response object
  const agentResponse = coerceAgentResponse({
    thought: {
      thinking: thinking || 'No reasoning provided',
      evaluation: evaluation || 'uncertain',
      memory: memory || 'No memory tracking',
      nextGoal: nextGoal || 'Continue task',
    },
    actions: toolCalls?.map(tc => ({
      name: tc.name,
      arguments: tc.arguments || {},
    })) || [],
    done,
    summary,
  });

  return fromAgentResponse(agentResponse);
}

/**
 * Parse from JSON format
 */
function parseFromJson(
  jsonData: any,
  toolCalls?: ToolCall[]
): ParsedAgentResponse | null {
  try {
    // Validate against schema
    const validated = AgentResponseSchema.safeParse(jsonData);
    if (validated.success) {
      return fromAgentResponse(validated.data);
    }
  } catch {
    // Invalid JSON, continue
  }

  return null;
}

// ============================================================================
// Main Parser Class
// ============================================================================

export class StructuredResponseParser {
  /**
   * Parse LLM response with Zod validation
   *
   * Handles multiple formats:
   * 1. JSON (bare or in code blocks)
   * 2. Tag-based format (<thinking>, <evaluation>, etc.)
   * 3. Mixed format (tags + tool calls)
   *
   * @param text - LLM response text
   * @param toolCalls - Optional tool calls from function calling
   * @returns Parsed and validated agent response
   */
  static parse(text: string, toolCalls?: ToolCall[]): ParsedAgentResponse {
    // Try JSON parse first (highest priority for structured output)
    const jsonData = extractJsonFromCodeBlocks(text);
    if (jsonData) {
      const parsed = parseFromJson(text, toolCalls);
      if (parsed) {
        return parsed;
      }
    }

    // Try to parse as bare JSON (without code blocks)
    try {
      const bareJson = JSON.parse(text.trim());
      const parsed = parseFromJson(text, toolCalls);
      if (parsed) {
        return parsed;
      }
    } catch {
      // Not valid JSON, continue to tag extraction
    }

    // Fallback to regex extraction with coercion
    return parseWithCoercion(text, toolCalls);
  }

  /**
   * Parse with strict validation (fails on parse errors)
   */
  static parseStrict(text: string, toolCalls?: ToolCall[]): ParsedAgentResponse | null {
    const config = (async () => {
      const { getConfig } = await import('../../core/config');
      return getConfig();
    })();

    // Try JSON parse
    const jsonData = extractJsonFromCodeBlocks(text);
    if (jsonData) {
      const validation = validateAgentResponse(jsonData);
      if (validation.success && validation.data) {
        return fromAgentResponse(validation.data);
      }
    }

    // Try tag extraction
    const parsed = this.parse(text, toolCalls);
    const validation = validateAgentResponse({
      thought: {
        thinking: parsed.thinking,
        evaluation: parsed.evaluationPreviousGoal,
        memory: parsed.memory,
        nextGoal: parsed.nextGoal,
      },
      actions: parsed.actions,
      done: parsed.done,
      summary: parsed.doneText,
    });

    if (!validation.success) {
      return null;
    }

    return parsed;
  }

  /**
   * Parse with retries on failure
   */
  static parseWithRetry(
    text: string,
    toolCalls?: ToolCall[],
    maxRetries: number = 3
  ): ParsedAgentResponse {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return this.parse(text, toolCalls);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next attempt
      }
    }

    // All retries failed, use coercion as last resort
    return parseWithCoercion(text, toolCalls);
  }

  /**
   * Validate a parsed response
   */
  static validate(parsed: ParsedAgentResponse): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (!parsed.thinking) errors.push('Thinking is required');
    if (!parsed.evaluationPreviousGoal) errors.push('Evaluation is required');
    if (!parsed.memory) errors.push('Memory is required');
    if (!parsed.nextGoal) errors.push('Next goal is required');

    // Check evaluation format
    if (parsed.evaluationPreviousGoal) {
      const evalLower = parsed.evaluationPreviousGoal.toLowerCase();
      if (!evalLower.includes('success') &&
          !evalLower.includes('failure') &&
          !evalLower.includes('uncertain')) {
        errors.push('Evaluation must indicate success/failure/uncertain');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a parsed response from partial data
   */
  static createPartial(
    partial: Partial<ParsedAgentResponse>
  ): ParsedAgentResponse {
    return {
      thinking: partial.thinking || 'No reasoning provided',
      evaluationPreviousGoal: partial.evaluationPreviousGoal || 'uncertain',
      memory: partial.memory || 'No memory tracking',
      nextGoal: partial.nextGoal || 'Continue task',
      actions: partial.actions || [],
      done: partial.done || false,
      doneText: partial.doneText || '',
      confidence: partial.confidence,
      estimatedRemainingSteps: partial.estimatedRemainingSteps,
    };
  }

  /**
   * Extract only the visible/conversational part of a response
   * (hides internal thinking for user-facing display)
   */
  static extractVisible(text: string): string {
    let visible = text;

    // Remove internal tags
    visible = visible.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    visible = visible.replace(/<evaluation>[\s\S]*?<\/evaluation>/gi, '');
    visible = visible.replace(/<memory>[\s\S]*?<\/memory>/gi, '');
    visible = visible.replace(/<next_goal>[\s\S]*?<\/next_goal>/gi, '');

    // Remove JSON code blocks
    visible = visible.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, '');

    // Clean up extra whitespace
    visible = visible.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    return visible;
  }

  /**
   * Check if response contains structured output
   */
  static hasStructuredOutput(text: string): boolean {
    return (
      text.includes('<thinking>') ||
      text.includes('<evaluation>') ||
      text.match(/```\s*\{/) !== null ||
      text.match(/^\s*\{/) !== null
    );
  }

  /**
   * Extract confidence from response
   */
  static extractConfidence(text: string): number {
    // Look for explicit confidence statements
    const patterns = [
      /confidence:\s*(\d+(?:\.\d+)?)/i,
      /certainty:\s*(\d+(?:\.\d+)?)/i,
      /sureness:\s*(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (value >= 0 && value <= 100) {
          return value / 100; // Convert percentage to 0-1
        }
        if (value >= 0 && value <= 1) {
          return value;
        }
      }
    }

    // Look for qualitative confidence
    const lowerText = text.toLowerCase();
    if (lowerText.includes('highly confident') || lowerText.includes('very sure')) {
      return 0.9;
    }
    if (lowerText.includes('confident') || lowerText.includes('sure')) {
      return 0.8;
    }
    if (lowerText.includes('somewhat confident') || lowerText.includes('fairly sure')) {
      return 0.6;
    }
    if (lowerText.includes('uncertain') || lowerText.includes('unsure')) {
      return 0.4;
    }
    if (lowerText.includes('very uncertain') || lowerText.includes('not sure')) {
      return 0.2;
    }

    return 0.8; // Default confidence
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick parse for simple use cases
 */
export function parseResponse(
  text: string,
  toolCalls?: ToolCall[]
): ParsedAgentResponse {
  return StructuredResponseParser.parse(text, toolCalls);
}

/**
 * Validate a response string
 */
export function validateResponseString(text: string): {
  valid: boolean;
  errors: string[];
} {
  const parsed = parseResponse(text);
  return StructuredResponseParser.validate(parsed);
}

/**
 * Extract thought components from text
 */
export function extractThoughtComponents(text: string): {
  thinking: string;
  evaluation: string;
  memory: string;
  nextGoal: string;
} {
  return {
    thinking: extractTag(text, 'thinking'),
    evaluation: extractTag(text, 'evaluation'),
    memory: extractTag(text, 'memory'),
    nextGoal: extractTag(text, 'next_goal'),
  };
}
