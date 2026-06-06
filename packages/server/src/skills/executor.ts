import type { SkillData } from "./format.js";
import { SkillError } from "../core/errors.js";

export interface SkillExecutionContext {
  browser: unknown;
  llm: unknown;
  tools: Map<string, (...args: unknown[]) => Promise<unknown>>;
  variables: Record<string, string>;
  onStep?: (step: number, total: number, description: string) => void;
}

async function interpretStep(
  step: string,
  context: SkillExecutionContext,
  index: number,
  total: number,
): Promise<string> {
  context.onStep?.(index + 1, total, step);

  if (context.llm && typeof (context.llm as any).chat === "function") {
    const llm = context.llm as {
      chat: (messages: Array<{ role: string; content: string }>) => Promise<string>;
    };
    const messages = [
      {
        role: "system",
        content:
          "You are executing a skill step. Perform the described action and return the result concisely.",
      },
      { role: "user", content: step },
    ];
    return await llm.chat(messages);
  }

  return step;
}

function substituteVariables(
  text: string,
  variables: Record<string, string>,
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export async function executeSkill(
  skillData: Record<string, unknown>,
  browserSession: unknown,
  llmProvider: unknown,
): Promise<string> {
  const steps = skillData.steps as string[] | undefined;
  if (!steps || steps.length === 0) {
    throw new SkillError("Skill has no steps to execute", "NO_STEPS");
  }

  const variables = (skillData.variables as string[] | undefined) ?? [];
  const varMap: Record<string, string> = {};
  for (const v of variables) {
    const val = process.env[`SKILL_VAR_${v.toUpperCase()}`] ?? "";
    varMap[v] = val;
  }

  const context: SkillExecutionContext = {
    browser: browserSession,
    llm: llmProvider,
    tools: new Map(),
    variables: varMap,
  };

  const resolvedSteps = steps.map((s) => substituteVariables(s, varMap));
  return executeSkillSteps(resolvedSteps, context);
}

export async function executeSkillSteps(
  steps: string[],
  context: SkillExecutionContext,
): Promise<string> {
  const results: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    try {
      const result = await interpretStep(steps[i], context, i, steps.length);
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Step ${i + 1} failed: ${msg}`);
      break;
    }
  }

  if (errors.length > 0) {
    throw new SkillError(errors.join("; "), "STEP_FAILED");
  }

  return results.join("\n");
}
