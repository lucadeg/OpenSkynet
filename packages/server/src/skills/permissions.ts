export interface SkillPermissions {
  allowedTools?: string[];
  allowedDomains?: string[];
  requiresConfirmation?: boolean;
}

const TOOL_ACTIONS = new Set([
  "browser_navigate",
  "browser_click",
  "browser_type",
  "browser_screenshot",
  "terminal_exec",
  "http_request",
  "file_read",
  "file_write",
]);

const DOMAIN_ACTIONS = new Set([
  "browser_navigate",
  "http_request",
]);

export function checkPermission(
  skill: Record<string, unknown>,
  action: string,
): boolean {
  const allowedTools = skill.allowed_tools as Record<string, string> | undefined;
  if (allowedTools && Object.keys(allowedTools).length > 0) {
    const toolName = action.split(":")[0];
    if (!(toolName in allowedTools)) return false;
  }

  return true;
}

export function getSkillPermissions(
  skill: Record<string, unknown>,
): SkillPermissions {
  const allowedTools = skill.allowed_tools as Record<string, string> | undefined;
  const tools = allowedTools ? Object.keys(allowedTools) : undefined;
  return {
    allowedTools: tools,
    requiresConfirmation: skill.disable_model_invocation === true,
  };
}
