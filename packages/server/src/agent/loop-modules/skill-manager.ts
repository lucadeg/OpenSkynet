export class SkillManager {
  constructor(private skillEngine: any) {}

  async findRelevantSkill(task: string): Promise<Record<string, unknown> | null> {
    const skills = await this.skillEngine.search(task);
    if (!skills || skills.length === 0) return null;
    return skills[0];
  }

  async executeSkill(name: string, browser: any, llm: any): Promise<string> {
    const skill = await this.skillEngine.getSkill(name);
    if (!skill) return `Skill not found: ${name}`;

    const steps = skill.structured_steps ?? skill.steps.map((s: string) => ({ description: s }));
    const results: string[] = [];

    for (const step of steps) {
      if (step.url) {
        await browser.navigate(step.url);
      }
      if (step.selector && step.text) {
        await browser.type(step.selector, step.text);
      } else if (step.selector) {
        await browser.click(step.selector);
      }
      results.push(`Completed: ${step.description}`);
    }

    return results.join("\n");
  }
}
