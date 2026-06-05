import type { RecordedFrame, RecordingSession } from "./models";

export class RecordingManager {
  private sessions: Map<string, RecordingSession> = new Map();

  startRecording(name: string): {
    sessionId: string;
    name: string;
    startedAt: string;
  } {
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: RecordingSession = {
      id,
      name,
      frames: [],
      startTime: Date.now(),
      status: "recording",
    };
    this.sessions.set(id, session);
    return { sessionId: id, name, startedAt: new Date().toISOString() };
  }

  stopRecording(sessionId: string): {
    sessionId: string;
    skillCreated: boolean;
    message: string;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        skillCreated: false,
        message: "Session not found",
      };
    }
    session.status = "stopped";
    session.endTime = Date.now();
    return {
      sessionId,
      skillCreated: session.frames.length > 0,
      message: `Recording stopped. ${session.frames.length} frames captured.`,
    };
  }

  getActiveSessions(): RecordingSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "recording"
    );
  }

  addFrame(sessionId: string, frame: RecordedFrame): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === "recording") {
      session.frames.push(frame);
    }
  }

  getSession(sessionId: string): RecordingSession | undefined {
    return this.sessions.get(sessionId);
  }
}
