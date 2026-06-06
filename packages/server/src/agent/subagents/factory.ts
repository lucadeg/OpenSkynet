import type { SubagentRegistry } from "./registry";
import type { SubagentSession } from "./session";
import { SubagentSession as Session } from "./session";

export class SubagentFactory {
  constructor(private registry: SubagentRegistry) {}

  create(mode: string, opts?: Record<string, unknown>): SubagentSession | null {
    const template = this.registry.get(mode);
    if (!template) return null;

    const id = opts?.id as string | undefined ?? `${mode}-${Date.now()}`;
    const session = new Session(id, mode);

    if (template.defaultModel) {
      Object.assign(session, { model: template.defaultModel });
    }
    if (template.systemPrompt) {
      Object.assign(session, { systemPrompt: template.systemPrompt });
    }

    return session;
  }
}
