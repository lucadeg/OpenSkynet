export class ToolMetricsCollector {
  private metrics = new Map<string, { calls: number; successes: number; failures: number; totalMs: number }>();

  record(name: string, durationMs: number, success: boolean): void {
    let m = this.metrics.get(name);
    if (!m) {
      m = { calls: 0, successes: 0, failures: 0, totalMs: 0 };
      this.metrics.set(name, m);
    }
    m.calls++;
    m.totalMs += durationMs;
    if (success) m.successes++;
    else m.failures++;
  }

  getMetrics(name: string): { calls: number; successes: number; failures: number; avgMs: number } | null {
    const m = this.metrics.get(name);
    if (!m) return null;
    return { calls: m.calls, successes: m.successes, failures: m.failures, avgMs: m.calls > 0 ? m.totalMs / m.calls : 0 };
  }

  getAllMetrics(): Record<string, { calls: number; successes: number; failures: number; avgMs: number }> {
    const result: Record<string, { calls: number; successes: number; failures: number; avgMs: number }> = {};
    for (const [name, m] of this.metrics) {
      result[name] = { calls: m.calls, successes: m.successes, failures: m.failures, avgMs: m.calls > 0 ? m.totalMs / m.calls : 0 };
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}
