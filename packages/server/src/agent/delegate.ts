export async function delegateParallel(
  tasks: Array<{ task: string; strategy: string }>,
  opts?: { maxConcurrency?: number },
): Promise<Array<{ task: string; success: boolean; result: string }>> {
  const maxConcurrency = opts?.maxConcurrency ?? 4;
  const results: Array<{ task: string; success: boolean; result: string }> = [];

  const execute = async (
    entry: { task: string; strategy: string },
  ): Promise<{ task: string; success: boolean; result: string }> => {
    try {
      const result = `[${entry.strategy}] executed: ${entry.task}`;
      return { task: entry.task, success: true, result };
    } catch (err) {
      return {
        task: entry.task,
        success: false,
        result: err instanceof Error ? err.message : String(err),
      };
    }
  };

  for (let i = 0; i < tasks.length; i += maxConcurrency) {
    const batch = tasks.slice(i, i + maxConcurrency);
    const settled = await Promise.allSettled(batch.map(execute));

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        results.push({
          task: batch[j].task,
          success: false,
          result: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        });
      }
    }
  }

  return results;
}
