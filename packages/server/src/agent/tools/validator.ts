import type { ToolDefinition } from "../../core/types.js";

export class DefaultToolValidator {
  validate(toolDef: ToolDefinition, args: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const params = toolDef.parameters;
    const properties = (params.properties ?? {}) as Record<string, { type?: string }>;
    const required = (params.required ?? []) as string[];

    for (const key of required) {
      if (args[key] === undefined || args[key] === null) {
        errors.push(`Missing required parameter: ${key}`);
      }
    }

    for (const [key, value] of Object.entries(args)) {
      const schema = properties[key];
      if (!schema) continue;
      if (schema.type && value !== undefined && value !== null) {
        const actual = Array.isArray(value) ? "array" : typeof value;
        if (schema.type !== actual) {
          errors.push(`Parameter "${key}" expected type ${schema.type}, got ${actual}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
