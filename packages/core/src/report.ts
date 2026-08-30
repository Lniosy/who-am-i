import { join } from "node:path";
import { collectAll } from "./collectors";
import { buildPayload, demoPayload } from "./dashboard";
import { reportsDir } from "./paths";
import { loadSettings } from "./settings";
import { loadFacts, loadReport, saveFacts, saveReport } from "./store";
import { synthesize } from "./synthesize";
import { parseDay } from "./time";
import { emptyFacts, type DailyReport, type DashboardPayload } from "./types";

export async function collectAndReport(dayRaw?: string): Promise<DailyReport> {
  const settings = loadSettings();
  const day = parseDay(dayRaw, settings.timezone);
  const facts = await collectAll(day, settings.timezone, settings.extra_git_paths);
  saveFacts(facts);
  const report = await synthesize(facts, settings);
  saveReport(report);
  await Bun.write(join(reportsDir(), `${day}.md`), report.raw_markdown);
  return report;
}

export async function dayPayload(dayRaw?: string, demo = false): Promise<DashboardPayload> {
  if (demo) return demoPayload();
  const settings = loadSettings();
  const day = parseDay(dayRaw, settings.timezone);
  const facts = loadFacts(day);
  const report = loadReport(day);
  if (!facts) {
    const payload = buildPayload(emptyFacts(day), null, false);
    payload.empty = true;
    payload.requested = day;
    return payload;
  }
  return buildPayload(facts, report, false);
}

export async function scanDay(dayRaw?: string) {
  const settings = loadSettings();
  const day = parseDay(dayRaw, settings.timezone);
  return collectAll(day, settings.timezone, settings.extra_git_paths);
}
