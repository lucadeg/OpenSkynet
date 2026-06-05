import { test, describe, expect } from "bun:test";
import { TaskClassifier } from "../../../src/agent/planning/task-classifier";

describe("TaskClassifier", () => {
  const classifier = new TaskClassifier();

  test("classifies code tasks as coding", () => {
    expect(classifier.classify("fix the bug in main.ts")).toBe("coding");
    expect(classifier.classify("implement a new function")).toBe("coding");
    expect(classifier.classify("refactor the database module")).toBe("coding");
  });

  test("classifies web tasks as browser", () => {
    expect(classifier.classify("navigate to google.com")).toBe("browser");
    expect(classifier.classify("open https://example.com")).toBe("browser");
    expect(classifier.classify("scrape the webpage for data")).toBe("browser");
  });

  test("classifies scheduling tasks as scheduling", () => {
    expect(classifier.classify("run this every hour")).toBe("scheduling");
    expect(classifier.classify("send a daily report")).toBe("scheduling");
    expect(classifier.classify("set up a cron job")).toBe("scheduling");
  });

  test("classifies general questions as conversational", () => {
    expect(classifier.classify("what is the meaning of life?")).toBe("conversational");
    expect(classifier.classify("how does photosynthesis work?")).toBe("conversational");
  });

  test("scheduling takes priority over coding", () => {
    expect(classifier.classify("schedule a weekly deploy")).toBe("scheduling");
  });

  test("file extensions trigger coding category", () => {
    expect(classifier.classify("update config.yaml")).toBe("coding");
    expect(classifier.classify("edit styles.css")).toBe("coding");
  });
});
