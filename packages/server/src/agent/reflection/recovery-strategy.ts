export class RecoveryStrategy {
  determine(
    error: Error,
    stepCount: number,
  ): { action: "retry" | "simplify" | "abort"; params?: Record<string, unknown> } {
    const msg = error.message.toLowerCase();

    if (msg.includes("rate limit") || msg.includes("429")) {
      return {
        action: "retry",
        params: { delayMs: Math.min(5000 * (stepCount + 1), 30000) },
      };
    }

    if (msg.includes("timeout") || msg.includes("timed out")) {
      if (stepCount < 3) {
        return { action: "retry", params: { timeout: 60000 } };
      }
      return { action: "simplify", params: { maxSteps: Math.max(stepCount - 2, 1) } };
    }

    if (msg.includes("auth") || msg.includes("unauthorized") || msg.includes("forbidden")) {
      return { action: "abort", params: { reason: "authentication_failure" } };
    }

    if (msg.includes("not found") || msg.includes("enoent")) {
      return { action: "abort", params: { reason: "resource_not_found" } };
    }

    if (stepCount < 5) {
      return { action: "retry" };
    }

    return { action: "simplify", params: { maxSteps: 3 } };
  }
}
