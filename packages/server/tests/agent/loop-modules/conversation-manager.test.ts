import { test, describe, expect } from "bun:test";
import { ConversationManager } from "../../../src/agent/loop-modules/conversation-manager";

describe("ConversationManager", () => {
  test("add appends messages", () => {
    const mgr = new ConversationManager();
    mgr.add("user", "hello");
    mgr.add("assistant", "hi");
    const msgs = mgr.getMessages();
    expect(msgs.length).toBe(2);
    expect(msgs[0]).toEqual({ role: "user", content: "hello" });
    expect(msgs[1]).toEqual({ role: "assistant", content: "hi" });
  });

  test("getMessages returns all messages", () => {
    const mgr = new ConversationManager();
    mgr.add("user", "a");
    mgr.add("assistant", "b");
    mgr.add("user", "c");
    expect(mgr.getMessages().length).toBe(3);
  });

  test("getRecent returns last N messages", () => {
    const mgr = new ConversationManager();
    mgr.add("user", "1");
    mgr.add("assistant", "2");
    mgr.add("user", "3");
    mgr.add("assistant", "4");
    const recent = mgr.getRecent(2);
    expect(recent.length).toBe(2);
    expect(recent[0].content).toBe("3");
    expect(recent[1].content).toBe("4");
  });

  test("setMessages replaces conversation", () => {
    const mgr = new ConversationManager();
    mgr.add("user", "old");
    mgr.setMessages([{ role: "system", content: "new" }]);
    expect(mgr.getMessages().length).toBe(1);
    expect(mgr.getMessages()[0].content).toBe("new");
  });

  test("clear empties conversation", () => {
    const mgr = new ConversationManager();
    mgr.add("user", "hello");
    mgr.add("assistant", "hi");
    mgr.clear();
    expect(mgr.getMessages().length).toBe(0);
  });

  test("getTokenCount returns number", () => {
    const mgr = new ConversationManager();
    mgr.add("user", "hello world");
    expect(mgr.getTokenCount()).toBeGreaterThan(0);
    expect(typeof mgr.getTokenCount()).toBe("number");
  });

  test("getTokenCount estimates based on character length", () => {
    const mgr = new ConversationManager();
    mgr.add("user", "a".repeat(40));
    expect(mgr.getTokenCount()).toBe(10);
  });

  test("getMessages returns a copy", () => {
    const mgr = new ConversationManager();
    mgr.add("user", "hello");
    const msgs = mgr.getMessages();
    msgs.push({ role: "user", content: "mutated" });
    expect(mgr.getMessages().length).toBe(1);
  });
});
