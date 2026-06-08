/**
 * Agent Schemas with Zod Validation
 *
 * Defines all structured output schemas for agent responses
 * Uses Zod for compile-time and runtime validation
 *
 * @module agent/schemas
 */

import { z } from 'zod';

// ============================================================================
// Core Agent Thought Schema
// ============================================================================

/**
 * The structured thought process that guides agent decisions
 * Mirrors browser-use's thinking → evaluation → memory → next_goal flow
 */
export const AgentThoughtSchema = z.object({
  /**
   * Reasoning about the current page state and task progress
   * What do I see? What does it mean? What should I do next?
   */
  thinking: z.string()
    .min(1, 'Thinking cannot be empty')
    .describe('Reasoning about current state and chosen actions'),

  /**
   * Evaluation of the previous action's outcome
   * Must include explicit success/failure judgment
   */
  evaluation: z.string()
    .min(1, 'Evaluation cannot be empty')
    .regex(/(success|failure|uncertain)/i, 'Evaluation must indicate success/failure/uncertain')
    .describe('Success/failure evaluation of previous action'),

  /**
   * Persistent memory tracking across the session
   * Should include: pages visited, items found, steps completed
   */
  memory: z.string()
    .min(1, 'Memory cannot be empty')
    .describe('Progress tracking to persist across steps'),

  /**
   * Clear, single-sentence statement of the immediate goal
   * What will I accomplish right now?
   */
  nextGoal: z.string()
    .min(1, 'Next goal cannot be empty')
    .max(200, 'Next goal should be concise')
    .describe('One clear sentence stating what to accomplish next'),
});

export type AgentThought = z.infer<typeof AgentThoughtSchema>;

// ============================================================================
// Tool Call Schema
// ============================================================================

/**
 * Individual tool/action call specification
 */
export const ToolCallSchema = z.object({
  /**
   * Name of the tool/action to call
   * Must match a registered tool name
   */
  name: z.string()
    .min(1)
    .regex(/^[a-z_][a-z0-9_]*$/, 'Tool name must be snake_case')
    .describe('Tool name to call'),

  /**
   * Arguments for the tool call
   * Structure depends on the specific tool
   */
  arguments: z.record(z.any())
    .describe('Tool arguments (structure depends on tool)'),

  /**
   * Optional reasoning for this tool call
   * Why am I calling this tool?
   */
  reasoning: z.string()
    .optional()
    .describe('Why this tool is being called'),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

// ============================================================================
// Agent Response Schema
// ============================================================================

/**
 * Complete agent response with all required fields
 * This is the main schema for LLM structured output
 */
export const AgentResponseSchema = z.object({
  /**
   * The thinking/reasoning component
   */
  thought: AgentThoughtSchema,

  /**
   * Tool calls to execute (optional - may be empty for text-only responses)
   */
  actions: z.array(ToolCallSchema)
    .max(10, 'Cannot execute more than 10 actions at once')
    .optional()
    .describe('Tool calls to execute (optional for text-only responses)'),

  /**
   * Completion signal
   * If true, agent believes task is complete
   */
  done: z.boolean()
    .describe('True if task is complete'),

  /**
   * Final summary when done=true
   * Must include all relevant findings, URLs, data, counts
   */
  summary: z.string()
    .optional()
    .describe('Final summary when done=true (must include all relevant findings)'),

  /**
   * Confidence in the response (0-1)
   * How sure is the agent about this response?
   */
  confidence: z.number()
    .min(0)
    .max(1)
    .optional()
    .describe('Confidence in this response (0-1)'),

  /**
   * Estimated remaining iterations
   * How many more steps does the agent think it needs?
   */
  estimatedRemainingSteps: z.number()
    .min(0)
    .optional()
    .describe('Estimated number of remaining steps'),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ============================================================================
// Task Decomposition Schema
// ============================================================================

/**
 * Schema for decomposing complex tasks into subtasks
 */
export const TaskDecompositionSchema = z.object({
  /**
   * The decomposed subtasks
   */
  subtasks: z.array(z.object({
    /**
     * Description of what this subtask accomplishes
     */
    description: z.string()
      .min(1)
      .describe('What this subtask accomplishes'),

    /**
     * IDs of subtasks this depends on
     * Empty array means no dependencies (can run in parallel)
     */
    dependencies: z.array(z.string())
      .default([])
      .describe('IDs of subtasks this depends on'),

    /**
     * Whether this subtask can be parallelized with others
     */
    canParallelize: z.boolean()
      .default(false)
      .describe('Can this run in parallel with independent subtasks?'),

    /**
     * Estimated difficulty (1-5)
     */
    difficulty: z.number()
      .min(1)
      .max(5)
      .default(3)
      .describe('Estimated difficulty (1=easy, 5=hard)'),
  }))
    .min(1)
    .max(20, 'Cannot decompose into more than 20 subtasks')
    .describe('Decomposed subtasks'),

  /**
   * Estimated total iterations needed
   */
  estimatedIterations: z.number()
    .min(1)
    .describe('Estimated total iterations needed'),

  /**
   * Reasoning for the decomposition strategy
   */
  reasoning: z.string()
    .describe('Why the task was decomposed this way'),
});

export type TaskDecomposition = z.infer<typeof TaskDecompositionSchema>;

// ============================================================================
// Memory Entry Schema
// ============================================================================

/**
 * Schema for memory entries
 */
export const MemoryEntrySchema = z.object({
  /**
   * The memory content
   */
  content: z.string()
    .min(1)
    .describe('Memory content'),

  /**
   * Memory type/level
   */
  type: z.enum(['step', 'task', 'session', 'global'])
    .describe('Memory scope level'),

  /**
   * Associated metadata
   */
  metadata: z.object({
    task: z.string().optional(),
    category: z.string().optional(),
    success: z.boolean().optional(),
    relatedNodes: z.array(z.string()).optional(),
    timestamp: z.number().optional(),
  }).optional()
    .describe('Associated metadata'),

  /**
   * Importance score (0-1)
   */
  importance: z.number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe('Importance score (0-1)'),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate agent response against schema
 */
export function validateAgentResponse(data: unknown): {
  success: boolean;
  data?: AgentResponse;
  errors?: string[];
} {
  const result = AgentResponseSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map(e =>
      `${e.path.join('.')}: ${e.message}`
    )
  };
}

/**
 * Validate and coerce agent response
 * Attempts to fix common errors
 */
export function coerceAgentResponse(data: unknown): AgentResponse {
  try {
    // Direct parse first
    return AgentResponseSchema.parse(data);
  } catch (error) {
    // Attempt coercion
    const obj = data as any;

    // Ensure required fields exist
    if (!obj.thought) {
      obj.thought = {
        thinking: obj.thinking || 'No reasoning provided',
        evaluation: obj.evaluation || 'uncertain',
        memory: obj.memory || 'No memory tracking',
        nextGoal: obj.nextGoal || 'Continue task'
      };
    }

    // Ensure done is boolean
    if (typeof obj.done !== 'boolean') {
      obj.done = obj.done === 'true' || obj.done === true;
    }

    // Ensure actions is array
    if (!Array.isArray(obj.actions)) {
      if (obj.actions) {
        obj.actions = [obj.actions];
      } else {
        obj.actions = [];
      }
    }

    // Parse again
    return AgentResponseSchema.parse(obj);
  }
}

/**
 * Create a valid agent response from partial data
 */
export function createAgentResponse(
  partial: Partial<AgentResponse>
): AgentResponse {
  return AgentResponseSchema.parse({
    thought: {
      thinking: partial.thought?.thinking || 'No reasoning provided',
      evaluation: partial.thought?.evaluation || 'uncertain',
      memory: partial.thought?.memory || 'No memory tracking',
      nextGoal: partial.thought?.nextGoal || 'Continue task'
    },
    actions: partial.actions || [],
    done: partial.done || false,
    summary: partial.summary,
    confidence: partial.confidence || 0.8,
    estimatedRemainingSteps: partial.estimatedRemainingSteps
  });
}

/**
 * Create a minimal valid agent response
 */
export function createMinimalResponse(
  thinking: string,
  memory: string,
  nextGoal: string,
  done: boolean = false
): AgentResponse {
  return createAgentResponse({
    thought: {
      thinking,
      evaluation: 'uncertain',
      memory,
      nextGoal
    },
    done
  });
}

/**
 * Create a success completion response
 */
export function createSuccessResponse(
  summary: string,
  memory: string
): AgentResponse {
  return createAgentResponse({
    thought: {
      thinking: 'Task completed successfully',
      evaluation: 'success',
      memory,
      nextGoal: 'Task complete'
    },
    done: true,
    summary,
    confidence: 1.0,
    estimatedRemainingSteps: 0
  });
}

/**
 * Create a failure completion response
 */
export function createFailureResponse(
  reason: string,
  memory: string
): AgentResponse {
  return createAgentResponse({
    thought: {
      thinking: `Task failed: ${reason}`,
      evaluation: 'failure',
      memory,
      nextGoal: 'Cannot continue'
    },
    done: true,
    summary: `Failed to complete task: ${reason}`,
    confidence: 0.5,
    estimatedRemainingSteps: 0
  });
}

// ============================================================================
// Schema Exports
// ============================================================================

export const schemas = {
  AgentThought: AgentThoughtSchema,
  ToolCall: ToolCallSchema,
  AgentResponse: AgentResponseSchema,
  TaskDecomposition: TaskDecompositionSchema,
  MemoryEntry: MemoryEntrySchema,
};
