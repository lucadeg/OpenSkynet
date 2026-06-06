import type { PlanStep, Strategy } from "../../core/types";
import type { LLMProvider } from "../../llm/provider";
import type { TaskCategory } from "./task-classifier";

export interface TaskPlan {
  steps: PlanStep[];
  strategy: Strategy;
  estimatedComplexity: "simple" | "moderate" | "complex";
}

const COMPLEXITY_MARKERS =
  /\b(complex|comprehensive|full|complete|entire|all|multiple|several|architect|design|refactor|migrate|integrate)\b/i;
const MODERATE_MARKERS =
  /\b(and|then|also|after|before|next|following|update|modify|change)\b/i;

export class TaskPlanner {
  constructor(private llmProvider: LLMProvider) {}

  planSync(task: string, category: TaskCategory): TaskPlan {
    const strategy = this._inferStrategy(task, category);
    const steps = this._generateSteps(task, category, strategy);
    const complexity = this._estimateComplexity(task);
    return { steps, strategy, estimatedComplexity: complexity };
  }

  async plan(task: string, category: TaskCategory): Promise<TaskPlan> {
    const complexity = this._estimateComplexity(task);
    if (complexity === "simple") return this.planSync(task, category);

    const systemPrompt = `You are a task planner. Break down the given task into structured steps.
Return a JSON object with:
- steps: array of { index, description, strategy, status }
- strategy: one of "direct", "use_skill", "delegate", "decompose"
- estimatedComplexity: one of "simple", "moderate", "complex"
Available strategies: direct, use_skill, delegate, decompose.`;

    const response = await this.llmProvider.chat(
      [{ role: "user", content: `Plan this task (category: ${category}):\n${task}` }],
      [],
      systemPrompt,
    );

    try {
      const text = response.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          steps: (parsed.steps ?? []).map((s: any, i: number) => ({
            index: s.index ?? i,
            description: s.description ?? "",
            strategy: s.strategy ?? "direct",
            status: s.status ?? "pending",
          })),
          strategy: parsed.strategy ?? "direct",
          estimatedComplexity: parsed.estimatedComplexity ?? complexity,
        };
      }
    } catch {}

    return this.planSync(task, category);
  }

  private _inferStrategy(task: string, category: TaskCategory): Strategy {
    if (category === "scheduling") return "delegate";
    if (category === "browser") return "direct";
    if (/\b(use|run|execute)\s+(skill|existing)\b/i.test(task)) return "use_skill";
    if (COMPLEXITY_MARKERS.test(task)) return "decompose";
    return "direct";
  }

  private _generateSteps(
    task: string,
    category: TaskCategory,
    strategy: Strategy,
  ): PlanStep[] {
    switch (category) {
      case "coding":
        return [
          { index: 0, description: `Analyze the coding task: ${task}`, strategy: "direct", status: "pending" },
          { index: 1, description: "Implement the solution", strategy: "direct", status: "pending" },
          { index: 2, description: "Verify the implementation", strategy: "direct", status: "pending" },
        ];
      case "browser":
        return [
          { index: 0, description: `Navigate and perform: ${task}`, strategy: "direct", status: "pending" },
          { index: 1, description: "Extract or verify results", strategy: "direct", status: "pending" },
        ];
      case "scheduling":
        return [
          { index: 0, description: "Parse schedule requirements", strategy: "delegate", status: "pending" },
          { index: 1, description: "Create scheduled job", strategy: "delegate", status: "pending" },
        ];
      default:
        return [
          { index: 0, description: `Process request: ${task}`, strategy, status: "pending" },
        ];
    }
  }

  private _estimateComplexity(task: string): "simple" | "moderate" | "complex" {
    if (COMPLEXITY_MARKERS.test(task)) return "complex";
    if (MODERATE_MARKERS.test(task)) return "moderate";
    return "simple";
  }
}
