export interface Artifact {
  type: "file" | "text" | "url" | "data";
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class ArtifactStore {
  private artifacts: Map<string, Artifact[]> = new Map();

  add(sessionId: string, artifact: Artifact): void {
    const list = this.artifacts.get(sessionId) ?? [];
    list.push(artifact);
    this.artifacts.set(sessionId, list);
  }

  get(sessionId: string): Artifact[] {
    return this.artifacts.get(sessionId) ?? [];
  }

  clear(sessionId: string): void {
    this.artifacts.delete(sessionId);
  }
}
