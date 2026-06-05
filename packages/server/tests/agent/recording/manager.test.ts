import { test, describe, expect } from "bun:test";
import { RecordingManager } from "../../../src/agent/recording/manager";

describe("RecordingManager", () => {
  test("startRecording creates a session", () => {
    const manager = new RecordingManager();
    const result = manager.startRecording("test recording");
    expect(result.sessionId).toMatch(/^rec_/);
    expect(result.name).toBe("test recording");
    expect(result.startedAt).toBeDefined();
  });

  test("stopRecording stops a session", () => {
    const manager = new RecordingManager();
    const { sessionId } = manager.startRecording("test");
    const result = manager.stopRecording(sessionId);
    expect(result.sessionId).toBe(sessionId);
    expect(result.skillCreated).toBe(false);
    expect(result.message).toContain("0 frames");
  });

  test("stopRecording returns error for unknown session", () => {
    const manager = new RecordingManager();
    const result = manager.stopRecording("unknown");
    expect(result.skillCreated).toBe(false);
    expect(result.message).toBe("Session not found");
  });

  test("getActiveSessions returns recording sessions", () => {
    const manager = new RecordingManager();
    manager.startRecording("active");
    expect(manager.getActiveSessions().length).toBe(1);
  });

  test("getActiveSessions excludes stopped sessions", () => {
    const manager = new RecordingManager();
    const { sessionId } = manager.startRecording("temp");
    manager.stopRecording(sessionId);
    expect(manager.getActiveSessions().length).toBe(0);
  });

  test("addFrame adds frames to recording session", () => {
    const manager = new RecordingManager();
    const { sessionId } = manager.startRecording("test");
    manager.addFrame(sessionId, {
      timestamp: Date.now(),
      url: "https://example.com",
      title: "Example",
    });
    const session = manager.getSession(sessionId);
    expect(session!.frames.length).toBe(1);
    const stopped = manager.stopRecording(sessionId);
    expect(stopped.skillCreated).toBe(true);
  });
});
