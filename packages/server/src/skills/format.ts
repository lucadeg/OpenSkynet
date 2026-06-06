import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SkillError } from "../core/errors.js";

export const SkillDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  steps: z.array(z.string()),
  category: z.string().optional().default("general"),
  version: z.number().default(1),
  variables: z.array(z.string()).optional().default([]),
  when_to_use: z.string().optional(),
  pitfalls: z.array(z.string()).optional().default([]),
  verification: z.string().optional(),
  structured_steps: z
    .array(
      z.object({
        description: z.string(),
        action_type: z.string().optional(),
        url: z.string().optional(),
        selector: z.string().optional(),
        text: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  disable_model_invocation: z.boolean().optional().default(false),
  allowed_tools: z.record(z.string()).optional(),
  context: z.string().optional().default(""),
  paths: z.array(z.string()).optional(),
  inputs: z
    .array(z.object({ name: z.string(), type: z.string() }))
    .optional(),
  outputs: z
    .array(z.object({ name: z.string(), type: z.string() }))
    .optional(),
  dependencies: z.array(z.string()).optional(),
  retry_policy: z.string().optional(),
  timeout_seconds: z.number().optional(),
  examples: z.array(z.string()).optional(),
  success_rate: z.number().optional(),
  execution_count: z.number().optional().default(0),
  avg_duration_ms: z.number().optional(),
  last_error: z.string().optional(),
  source: z.string().optional().default("local"),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  use_count: z.number().optional().default(0),
  last_used_at: z.string().optional(),
});

export type SkillData = z.infer<typeof SkillDataSchema>;

export function loadSkill(skillDir: string): SkillData | null {
  const filePath = join(skillDir, "skill.json");
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return SkillDataSchema.parse(parsed);
  } catch (err) {
    throw new SkillError(
      `Failed to load skill from ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function skillToSkillMd(data: SkillData): string {
  const lines: string[] = [];
  lines.push(`# ${data.name}`);
  lines.push("");
  lines.push(data.description);
  lines.push("");

  if (data.when_to_use) {
    lines.push("## When to Use");
    lines.push("");
    lines.push(data.when_to_use);
    lines.push("");
  }

  if (data.category) {
    lines.push(`**Category:** ${data.category}`);
    lines.push("");
  }

  lines.push(`**Version:** ${data.version}`);
  lines.push("");

  if (data.variables && data.variables.length > 0) {
    lines.push("## Variables");
    lines.push("");
    for (const v of data.variables) {
      lines.push(`- \`{{${v}}}\``);
    }
    lines.push("");
  }

  lines.push("## Steps");
  lines.push("");
  for (let i = 0; i < data.steps.length; i++) {
    lines.push(`${i + 1}. ${data.steps[i]}`);
  }
  lines.push("");

  if (data.structured_steps && data.structured_steps.length > 0) {
    lines.push("## Structured Steps");
    lines.push("");
    for (const step of data.structured_steps) {
      let line = `- **${step.description}**`;
      if (step.action_type) line += ` [${step.action_type}]`;
      if (step.url) line += ` (${step.url})`;
      if (step.selector) line += ` selector=\`${step.selector}\``;
      if (step.text) line += ` text="${step.text}"`;
      lines.push(line);
    }
    lines.push("");
  }

  if (data.pitfalls && data.pitfalls.length > 0) {
    lines.push("## Pitfalls");
    lines.push("");
    for (const p of data.pitfalls) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  if (data.verification) {
    lines.push("## Verification");
    lines.push("");
    lines.push(data.verification);
    lines.push("");
  }

  if (data.examples && data.examples.length > 0) {
    lines.push("## Examples");
    lines.push("");
    for (const ex of data.examples) {
      lines.push(`- ${ex}`);
    }
    lines.push("");
  }

  if (data.context) {
    lines.push("## Context");
    lines.push("");
    lines.push(data.context);
    lines.push("");
  }

  return lines.join("\n");
}

export function skillToJson(data: SkillData): Record<string, unknown> {
  const { ...rest } = SkillDataSchema.parse(data);
  return { ...rest } as Record<string, unknown>;
}
