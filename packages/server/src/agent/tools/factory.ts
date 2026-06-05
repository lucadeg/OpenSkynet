import { ToolBus } from "./bus.js";
import { MemoryCache } from "./cache.js";
import { ToolMetricsCollector } from "./metrics.js";

export function createToolBus(): ToolBus {
  return new ToolBus();
}

export function createMinimalToolBus(): ToolBus {
  return new ToolBus();
}

export function createPerformanceToolBus(): ToolBus {
  const bus = new ToolBus();
  const metrics = new ToolMetricsCollector();
  const cache = new MemoryCache();
  const originalExecute = bus.execute.bind(bus);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bus as any).execute = async (name: string, args: Record<string, unknown>) => {
    const cacheKey = `${name}:${JSON.stringify(args)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const start = Date.now();
    const result = await originalExecute(name, args);
    metrics.record(name, Date.now() - start, result.success);
    cache.set(cacheKey, result);
    return result;
  };

  return bus;
}
