import { getConfig } from "../core/config.js";

export function validateSkill(data: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const config = getConfig();

  if (!data.name || typeof data.name !== "string") {
    errors.push("Skill must have a name (string).");
  } else if (!config.safeNameRe.test(data.name)) {
    errors.push(
      `Skill name "${data.name}" must match ${config.safeNameRe.source}.`,
    );
  } else if (data.name.length > config.maxNameLength) {
    errors.push(
      `Skill name exceeds max length of ${config.maxNameLength}.`,
    );
  }

  if (!data.description || typeof data.description !== "string" || (data.description as string).trim().length === 0) {
    errors.push("Skill must have a non-empty description.");
  }

  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    errors.push("Skill must have at least one step.");
  } else {
    for (let i = 0; i < data.steps.length; i++) {
      if (typeof data.steps[i] !== "string" || data.steps[i].trim().length === 0) {
        errors.push(`Step ${i + 1} must be a non-empty string.`);
      }
    }
  }

  if (data.structured_steps != null) {
    if (!Array.isArray(data.structured_steps)) {
      errors.push("structured_steps must be an array.");
    } else {
      for (let i = 0; i < data.structured_steps.length; i++) {
        const step = data.structured_steps[i] as Record<string, unknown>;
        if (!step || typeof step !== "object") {
          errors.push(`structured_steps[${i}] must be an object.`);
        } else if (!step.description || typeof step.description !== "string") {
          errors.push(`structured_steps[${i}] must have a description.`);
        }
      }
    }
  }

  if (data.version != null && typeof data.version !== "number") {
    errors.push("version must be a number.");
  }

  if (data.variables != null && !Array.isArray(data.variables)) {
    errors.push("variables must be an array.");
  }

  if (data.pitfalls != null && !Array.isArray(data.pitfalls)) {
    errors.push("pitfalls must be an array.");
  }

  if (data.timeout_seconds != null && typeof data.timeout_seconds !== "number") {
    errors.push("timeout_seconds must be a number.");
  }

  if (data.disable_model_invocation != null && typeof data.disable_model_invocation !== "boolean") {
    errors.push("disable_model_invocation must be a boolean.");
  }

  if (data.allowed_tools != null && typeof data.allowed_tools !== "object") {
    errors.push("allowed_tools must be an object.");
  }

  return { valid: errors.length === 0, errors };
}
