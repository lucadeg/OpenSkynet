import type { AgentTemplate } from "./template";
import { BUILTIN_TEMPLATES } from "./template";

export class SubagentRegistry {
  private templates: Map<string, AgentTemplate> = new Map();

  constructor() {
    for (const t of BUILTIN_TEMPLATES) {
      this.templates.set(t.mode, t);
    }
  }

  register(template: AgentTemplate): void {
    this.templates.set(template.mode, template);
  }

  get(mode: string): AgentTemplate | undefined {
    return this.templates.get(mode);
  }

  list(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  unregister(mode: string): boolean {
    return this.templates.delete(mode);
  }
}
