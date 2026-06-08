/**
 * Task Decomposition and Planning
 *
 * Breaks complex tasks into subtasks with dependency tracking
 * Enables parallel execution where possible
 *
 * @module agent/planning
 */

import { createLogger } from '../../core/logging';
import type { LLMProvider } from '../../llm/provider';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const logger = createLogger('task-planner');

// ============================================================================
// Type Definitions
// ============================================================================

export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  canParallelize: boolean;
  difficulty: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface TaskPlan {
  original: string;
  subtasks: SubTask[];
  executionOrder: string[][];
  estimatedIterations: number;
  reasoning: string;
  estimatedDuration?: number;
}

export interface SubTaskResult {
  subtaskId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

const SubTaskSchema = z.object({
  description: z.string().min(1),
  dependencies: z.array(z.string()).default([]),
  canParallelize: z.boolean().default(false),
  difficulty: z.number().min(1).max(5).default(3)
});

const TaskDecompositionOutputSchema = z.object({
  subtasks: z.array(SubTaskSchema).min(1).max(20),
  estimatedIterations: z.number().min(1),
  reasoning: z.string()
});

// ============================================================================
// Task Planner
// ============================================================================

export class TaskPlanner {
  constructor(private llm: LLMProvider) {
    logger.info('[TaskPlanner] Initialized');
  }

  /**
   * Decompose complex task into subtasks
   */
  async decompose(task: string): Promise<TaskPlan> {
    logger.info({ task }, '[TaskPlanner] Decomposing task');

    const systemPrompt = `You are a task planning expert. Break down complex tasks into clear, executable subtasks.

<rules>
1. Each subtask should be specific and actionable
2. Identify dependencies between subtasks
3. Mark subtasks that can run in parallel
4. Estimate difficulty (1=easy, 5=hard)
5. Provide reasoning for your decomposition
</rules>

<output_format>
Respond with JSON matching this schema:
{
  "subtasks": [
    {
      "description": "Specific actionable step",
      "dependencies": ["id1", "id2"], // Empty if no dependencies
      "canParallelize": true/false,
      "difficulty": 1-5
    }
  ],
  "estimatedIterations": total_estimate,
  "reasoning": "Why you decomposed this way"
}
</output_format>`;

    try {
      const response = await this.llm.chat(
        [{ role: 'user', content: `Break this task into subtasks: "${task}"` }],
        [],
        systemPrompt
      );

      // Try to parse response
      let parsed: any;
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch {
        // If not JSON, try to extract JSON from response
        const jsonMatch = (response.text || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not extract JSON from response');
        }
      }

      // Validate against schema
      const validated = TaskDecompositionOutputSchema.safeParse(parsed);
      if (!validated.success) {
        logger.warn({ errors: validated.error.errors }, '[TaskPlanner] Validation failed, using raw data');
        // Continue with raw data
      }

      const data = validated.success ? validated.data : parsed;

      // Create subtask objects
      const subtasks: SubTask[] = (data.subtasks || []).map((st: any, i: number) => ({
        id: `subtask-${i}`,
        description: st.description,
        dependencies: st.dependencies || [],
        canParallelize: st.canParallelize || false,
        difficulty: st.difficulty || 3,
        status: 'pending' as const
      }));

      // Calculate execution order
      const executionOrder = this.calculateExecutionOrder(subtasks);

      const plan: TaskPlan = {
        original: task,
        subtasks,
        executionOrder,
        estimatedIterations: data.estimatedIterations || subtasks.length * 3,
        reasoning: data.reasoning || 'Task decomposition complete'
      };

      logger.info({
        subtaskCount: subtasks.length,
        parallelGroups: executionOrder.length
      }, '[TaskPlanner] Task decomposed');

      return plan;
    } catch (error) {
      logger.error({ err: error as Error }, '[TaskPlanner] Decomposition failed');

      // Fallback to single subtask
      return {
        original: task,
        subtasks: [{
          id: 'subtask-0',
          description: task,
          dependencies: [],
          canParallelize: false,
          difficulty: 3,
          status: 'pending'
        }],
        executionOrder: [['subtask-0']],
        estimatedIterations: 10,
        reasoning: 'Fallback to single subtask due to decomposition failure'
      };
    }
  }

  /**
   * Calculate which subtasks can run in parallel
   */
  calculateExecutionOrder(subtasks: SubTask[]): string[][] {
    const order: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(subtasks.map(st => st.id));

    // Build dependency map
    const dependencyMap = new Map<string, Set<string>>();
    for (const st of subtasks) {
      dependencyMap.set(st.id, new Set(st.dependencies));
    }

    while (remaining.size > 0) {
      // Find all subtasks whose dependencies are satisfied
      const ready = [...remaining].filter(id => {
        const deps = dependencyMap.get(id);
        return deps && [...deps].every(depId => completed.has(depId));
      });

      if (ready.length === 0) {
        // Circular dependency or just no more dependencies
        order.push([...remaining]);
        break;
      }

      order.push(ready);

      // Mark as completed
      for (const id of ready) {
        completed.add(id);
        remaining.delete(id);
      }
    }

    return order;
  }

  /**
   * Execute plan with parallel execution where possible
   */
  async executePlan(
    plan: TaskPlan,
    executor: (subtask: SubTask) => Promise<any>
  ): Promise<SubTaskResult[]> {
    logger.info({ subtaskCount: plan.subtasks.length }, '[TaskPlanner] Executing plan');

    const results: Map<string, SubTaskResult> = new Map();

    for (const group of plan.executionOrder) {
      logger.info({ groupSize: group.length, parallel: group.length > 1 }, '[TaskPlanner] Executing group');

      // Execute group (potentially in parallel)
      const groupResults = await Promise.all(
        group.map(async (id) => {
          const subtask = plan.subtasks.find(st => st.id === id);
          if (!subtask) {
            return {
              subtaskId: id,
              success: false,
              error: 'Subtask not found',
              duration: 0
            };
          }

          subtask.status = 'in_progress';
          subtask.startedAt = Date.now();

          try {
            const result = await executor(subtask);

            subtask.status = 'completed';
            subtask.completedAt = Date.now();
            subtask.result = result;

            const duration = (subtask.completedAt - subtask.startedAt) / 1000;

            logger.info({ id, duration }, '[TaskPlanner] Subtask completed');

            return {
              subtaskId: id,
              success: true,
              result,
              duration
            };
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);

            subtask.status = 'failed';
            subtask.completedAt = Date.now();
            subtask.error = errMsg;

            logger.error({ id, error: errMsg }, '[TaskPlanner] Subtask failed');

            return {
              subtaskId: id,
              success: false,
              error: errMsg,
              duration: (subtask.completedAt - (subtask.startedAt || Date.now())) / 1000
            };
          }
        })
      );

      // Store results
      for (const result of groupResults) {
        results.set(result.subtaskId, result);
      }

      // Check if we should continue
      const failedCount = [...results.values()].filter(r => !r.success).length;
      if (failedCount > group.length / 2) {
        logger.warn({ failedCount }, '[TaskPlanner] Too many failures, stopping execution');
        break;
      }
    }

    return [...results.values()];
  }

  /**
   * Get plan statistics
   */
  getPlanStats(plan: TaskPlan): {
    totalSubtasks: number;
    parallelGroups: number;
    maxParallelism: number;
    estimatedDuration: number;
  } {
    const maxParallelism = Math.max(...plan.executionOrder.map(g => g.length));
    const avgDifficulty = plan.subtasks.reduce((sum, st) => sum + st.difficulty, 0) / plan.subtasks.length;

    // Rough estimate: 30 seconds * difficulty * (1 + parallelism * 0.3)
    const estimatedDuration = plan.estimatedIterations * avgDifficulty * 30;

    return {
      totalSubtasks: plan.subtasks.length,
      parallelGroups: plan.executionOrder.length,
      maxParallelism,
      estimatedDuration: Math.floor(estimatedDuration)
    };
  }

  /**
   * Check if task needs decomposition
   */
  shouldDecompose(task: string): boolean {
    const words = task.split(/\s+/);
    const andCount = (task.match(/\sand\s/gi) || []).length;
    const commaCount = (task.match(/,/g) || []).length;

    // Decompose if:
    // - Contains "and" multiple times
    // - Contains multiple commas
    // - Word count > 15
    return words.length > 15 || andCount >= 2 || commaCount >= 2;
  }
}

/**
 * Create task planner
 */
export function createTaskPlanner(llm: LLMProvider): TaskPlanner {
  return new TaskPlanner(llm);
}
