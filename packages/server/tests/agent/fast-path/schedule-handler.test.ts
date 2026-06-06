import { test, describe, expect } from "bun:test";
import { ScheduleHandler } from "../../../src/agent/fast-path/schedule-handler";

describe("ScheduleHandler", () => {
  test("detectSchedule returns cron for 'every hour' pattern", () => {
    const handler = new ScheduleHandler();
    const result = handler.detectSchedule("every hour check the server");
    expect(result).not.toBeNull();
    expect(result!.cron).toBe("0 * * * *");
  });

  test("detectSchedule returns cron for 'every 30 minutes' pattern", () => {
    const handler = new ScheduleHandler();
    const result = handler.detectSchedule("every 30 minutes ping the API");
    expect(result).not.toBeNull();
    expect(result!.cron).toBe("*/30 * * * *");
  });

  test("detectSchedule returns cron for 'every day at 9am' pattern", () => {
    const handler = new ScheduleHandler();
    const result = handler.detectSchedule("every day at 9am send report");
    expect(result).not.toBeNull();
    expect(result!.cron).toBe("0 9 * * *");
  });

  test("detectSchedule returns null for non-schedule tasks", () => {
    const handler = new ScheduleHandler();
    expect(handler.detectSchedule("What is 2+2?")).toBeNull();
    expect(handler.detectSchedule("Navigate to google.com")).toBeNull();
    expect(handler.detectSchedule("")).toBeNull();
  });

  test("detectSchedule handles PM time correctly", () => {
    const handler = new ScheduleHandler();
    const result = handler.detectSchedule("every day at 3pm run backup");
    expect(result).not.toBeNull();
    expect(result!.cron).toBe("0 15 * * *");
  });

  test("detectSchedule handles hourly keyword", () => {
    const handler = new ScheduleHandler();
    const result = handler.detectSchedule("each hourly check health");
    expect(result).not.toBeNull();
    expect(result!.cron).toBe("0 * * * *");
  });
});
