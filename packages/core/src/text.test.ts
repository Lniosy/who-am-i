import { describe, expect, test } from "bun:test";
import { displayProject, isJunkTitle, pickTitle } from "./text";

describe("titles", () => {
  test("uuid and agents.md are junk", () => {
    expect(isJunkTitle("01a0523a-b3ce-7d21-8e62-aebd8d2f8c60")).toBe(true);
    expect(isJunkTitle("# AGENTS.md instructions <INSTRUCTIONS>")).toBe(true);
    expect(isJunkTitle("写采集器")).toBe(false);
  });
  test("pick first real prompt", () => {
    expect(
      pickTitle(["01a0523a-b3ce-7d21-8e62-aebd8d2f8c60", "看下这个项目是否需要改进"], "x"),
    ).toBe("看下这个项目是否需要改进");
  });
  test("decode grok project path", () => {
    expect(displayProject("%2FUsers%2Flniosy%2FDocuments%2Fwho-am-i")).toBe("who-am-i");
  });
});
