import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { SkillEngine } from "./engine.js";
import { SkillDataSchema } from "./format.js";
import { validateSkill } from "./validator.js";
import logger from "../core/logging.js";

export class SkillHealer {
  heal(
    name: string,
    engine: SkillEngine,
  ): { healed: boolean; changes: string[] } {
    const changes: string[] = [];
    const dir = join((engine as any).skillsDir as string, name);

    if (!existsSync(dir)) {
      return { healed: false, changes: ["Skill directory not found."] };
    }

    const filePath = join(dir, "skill.json");
    if (!existsSync(filePath)) {
      return { healed: false, changes: ["skill.json not found."] };
    }

    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      return { healed: false, changes: ["Cannot read skill.json."] };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const fixed = raw
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/'/g, '"')
        .replace(/(\w+)\s*:/g, '"$1":')
        .trim();
      try {
        parsed = JSON.parse(fixed);
        changes.push("Fixed malformed JSON.");
      } catch {
        return { healed: false, changes: ["Cannot parse skill.json after repair attempts."] };
      }
    }

    if (!parsed.name || typeof parsed.name !== "string") {
      parsed.name = name;
      changes.push("Set missing name from directory name.");
    }

    if (!parsed.description || typeof parsed.description !== "string") {
      parsed.description = `Skill: ${name}`;
      changes.push("Added placeholder description.");
    }

    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      if (parsed.structured_steps && Array.isArray(parsed.structured_steps)) {
        parsed.steps = (parsed.structured_steps as Array<Record<string, unknown>>).map(
          (s) => (s.description as string) ?? "Unnamed step",
        );
        changes.push("Generated steps from structured_steps.");
      } else {
        parsed.steps = ["Complete the task described in the description."];
        changes.push("Added default step for empty steps array.");
      }
    }

    if (parsed.version == null || typeof parsed.version !== "number") {
      parsed.version = 1;
      changes.push("Set default version to 1.");
    }

    if (!parsed.category) {
      parsed.category = "general";
      changes.push("Set default category to 'general'.");
    }

    if (!parsed.variables) {
      parsed.variables = [];
    }

    if (!parsed.pitfalls) {
      parsed.pitfalls = [];
    }

    if (!parsed.structured_steps) {
      parsed.structured_steps = [];
    }

    if (!parsed.source) {
      parsed.source = "local";
    }

    if (!parsed.context) {
      parsed.context = "";
    }

    if (!parsed.created_at) {
      parsed.created_at = new Date().toISOString();
      changes.push("Set created_at timestamp.");
    }

    parsed.updated_at = new Date().toISOString();

    try {
      const validated = SkillDataSchema.parse(parsed);
      const validation = validateSkill(validated as Record<string, unknown>);
      if (!validation.valid) {
        return { healed: false, changes: validation.errors };
      }

      const tmp = `${filePath}.tmp`;
      writeFileSync(tmp, JSON.stringify(validated, null, 2) + "\n", "utf-8");
      renameSync(tmp, filePath);

      logger.info({ skill: name, changes }, "skill_healed");
      return { healed: true, changes };
    } catch (err) {
      return {
        healed: false,
        changes: [
          ...changes,
          `Schema validation failed: ${err instanceof Error ? err.message : String(err)}`,
        ],
      };
    }
  }
}
