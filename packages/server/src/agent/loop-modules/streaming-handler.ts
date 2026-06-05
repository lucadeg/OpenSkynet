export class StreamingHandler {
  private tokenCallbacks: Array<(token: string) => void> = [];
  private stepCallbacks: Array<(action: string, detail: string) => void> = [];
  private progressCallbacks: Array<(phase: string, data?: Record<string, unknown>) => void> = [];

  onToken(token: string): void {
    for (const cb of this.tokenCallbacks) cb(token);
  }

  onStep(action: string, detail: string): void {
    for (const cb of this.stepCallbacks) cb(action, detail);
  }

  onProgress(phase: string, data?: Record<string, unknown>): void {
    for (const cb of this.progressCallbacks) cb(phase, data);
  }
}
