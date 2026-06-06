import type { LLMProvider } from "../llm/provider";
import type { TaskCategory } from "./planning/task-classifier";
import { TaskClassifier } from "./planning/task-classifier";
import { TaskPlanner } from "./planning/task-planner";
import type { ManagerPlan } from "./planning/manager-plan";

export class ManagerAgent {
  constructor(
    private llmProvider: LLMProvider,
    private classifier: TaskClassifier = new TaskClassifier(),
    private planner: TaskPlanner = new TaskPlanner(llmProvider),
  ) {}

  async manage(task: string): Promise<ManagerPlan> {
    const category = this.classifier.classify(task);
    const plan = await this.planner.plan(task, category);

    if (plan.estimatedComplexity === "simple" && plan.steps.length <= 1) {
      return {
        subtasks: [{ task, strategy: plan.strategy }],
        coordinationNotes: "Single-step task, no decomposition needed.",
      };
    }

    const subtasks: ManagerPlan["subtasks"] = plan.steps.map((step) => {
      const subCategory = this.classifier.classify(step.description);
      return {
        task: step.description,
        strategy: step.strategy,
        delegateTo: this._resolveDelegate(subCategory),
      };
    });

    return {
      subtasks,
      coordinationNotes: `Decomposed into ${subtasks.length} subtasks (original category: ${category}).`,
    };
  }

  private _resolveDelegate(category: TaskCategory): string | undefined {
    switch (category) {
      case "coding":
        return "coding-agent";
      case "browser":
        return "browser-agent";
      default:
        return undefined;
    }
  }
}
