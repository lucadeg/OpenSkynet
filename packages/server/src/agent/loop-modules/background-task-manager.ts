export class BackgroundTaskManager {
  private tasks: Array<{ promise: Promise<void>; reject: (reason?: any) => void }> = [];

  submit(task: () => Promise<void>): void {
    let rejectFn: (reason?: any) => void;
    const promise = new Promise<void>((resolve, reject) => {
      rejectFn = reject;
      task().then(resolve).catch(reject);
    });
    this.tasks.push({ promise, reject: rejectFn! });
  }

  async waitForAll(): Promise<void> {
    await Promise.all(this.tasks.map((t) => t.promise));
    this.tasks = [];
  }

  cancelAll(): void {
    for (const t of this.tasks) {
      t.reject(new Error("Task cancelled"));
      t.promise.catch(() => {});
    }
    this.tasks = [];
  }
}
