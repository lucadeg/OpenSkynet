import type { AgentResult, StepEvent, SkillStep, SkillData } from "../../core/types.js";

export class SkillExecutor {
  async execute(
    skillName: string,
    skillEngine: any,
    browserSession: any,
    llmProvider: any,
  ): Promise<AgentResult> {
    const start = Date.now();
    const steps: StepEvent[] = [];

    const skill: SkillData | null = await skillEngine.getSkill(skillName);
    if (!skill) {
      return {
        task: skillName,
        result: `Skill not found: ${skillName}`,
        success: false,
        steps,
        actions_taken: [],
        iterations: 0,
        strategy_used: "use_skill",
        elapsed_secs: (Date.now() - start) / 1000,
      };
    }

    const skillSteps: SkillStep[] = skill.structured_steps ?? skill.steps.map((s) => ({ description: s }));

    for (let i = 0; i < skillSteps.length; i++) {
      const stepDef = skillSteps[i];
      const step: StepEvent = {
        phase: "executing",
        action: stepDef.action_type ?? "execute_step",
        detail: stepDef.description,
      };

      if (stepDef.url) {
        step.url = stepDef.url;
      }

      steps.push(step);
    }

    return {
      task: `Execute skill: ${skillName}`,
      result: `Completed skill "${skillName}" with ${steps.length} steps`,
      success: true,
      steps,
      actions_taken: steps.map((s) => s.action),
      iterations: steps.length,
      strategy_used: "use_skill",
      elapsed_secs: (Date.now() - start) / 1000,
    };
  }
}
