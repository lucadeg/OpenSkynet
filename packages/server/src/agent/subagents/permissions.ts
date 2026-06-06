export interface PermissionRules {
  allowedTools: string[];
  deniedTools: string[];
  maxIterations: number;
  maxTimeMs: number;
  requireApproval: string[];
}

export const DEFAULT_PERMISSIONS: PermissionRules = {
  allowedTools: ["*"],
  deniedTools: [],
  maxIterations: 25,
  maxTimeMs: 300_000,
  requireApproval: ["file:delete", "system:exec"],
};

export function checkPermission(
  rules: PermissionRules,
  tool: string,
): { allowed: boolean; reason?: string } {
  if (rules.deniedTools.includes(tool)) {
    return { allowed: false, reason: `Tool "${tool}" is explicitly denied` };
  }

  if (rules.deniedTools.includes("*")) {
    return { allowed: false, reason: "All tools are denied" };
  }

  if (rules.allowedTools.includes("*")) {
    return { allowed: true };
  }

  if (!rules.allowedTools.includes(tool)) {
    return { allowed: false, reason: `Tool "${tool}" is not in the allowed list` };
  }

  return { allowed: true };
}
