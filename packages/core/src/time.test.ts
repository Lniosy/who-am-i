import { describe, expect, test } from "bun:test";
import { clusterTimestamps, dayKey, mergeHours, onDay, parseTs } from "./time";

describe("parseTs", () => {
  test("unix seconds", () => {
    const d = parseTs(1788085980);
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
  });
  test("unix ms", () => {
    const d = parseTs(1788085979952);
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
  });
  test("iso z", () => {
    const d = parseTs("2026-08-30T10:32:54.199Z");
    expect(d).not.toBeNull();
    expect(onDay(d, "2026-08-30", "Asia/Shanghai")).toBe(true);
  });
});

describe("hours", () => {
  test("cluster splits idle gaps", () => {
    const a = new Date("2026-08-30T01:00:00Z");
    const b = new Date("2026-08-30T01:05:00Z");
    const c = new Date("2026-08-30T05:00:00Z");
    const clusters = clusterTimestamps([a, b, c]);
    expect(clusters.length).toBe(2);
    const hours = clusters.reduce((s, x) => s + x.hours, 0);
    expect(hours).toBeLessThan(1);
  });
  test("merge overlaps once", () => {
    const w1 = { start: new Date("2026-08-30T01:00:00Z"), end: new Date("2026-08-30T03:00:00Z") };
    const w2 = { start: new Date("2026-08-30T02:00:00Z"), end: new Date("2026-08-30T04:00:00Z") };
    expect(mergeHours([w1, w2])).toBe(3);
  });
});

describe("timezone", () => {
  test("shanghai date of utc morning", () => {
    const d = new Date("2026-08-29T16:30:00Z");
    expect(dayKey(d, "Asia/Shanghai")).toBe("2026-08-30");
  });
});
