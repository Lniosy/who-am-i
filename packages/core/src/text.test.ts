import { describe, expect, test } from "bun:test";
import { displayProject, isJunkTitle, pickTitle } from "./text";

describe("titles", () => {
  test("uuid and agents.md are junk", () => {
    expect(isJunkTitle("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isJunkTitle("# AGENTS.md instructions <INSTRUCTIONS>")).toBe(true);
    expect(isJunkTitle("写采集器")).toBe(false);
  });
  test("pick first real prompt", () => {
    expect(
      pickTitle(["00000000-0000-4000-8000-000000000001", "把采集器接到日报上"], "x"),
    ).toBe("把采集器接到日报上");
  });
  test("decode grok project path", () => {
    expect(displayProject("%2FUsers%2Fdemo%2FDocuments%2Fwho-am-i")).toBe("who-am-i");
  });
});
