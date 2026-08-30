import { Database } from "bun:sqlite";
import { dbPath } from "./paths";
import type { DailyReport, DayFacts } from "./types";

function connect(path = dbPath()): Database {
  const db = new Database(path);
  db.run(`
    CREATE TABLE IF NOT EXISTS days (
      date TEXT PRIMARY KEY,
      facts_json TEXT NOT NULL,
      report_json TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return db;
}

export function saveFacts(facts: DayFacts): void {
  const db = connect();
  db.run(
    `INSERT INTO days(date, facts_json)
     VALUES(?, ?)
     ON CONFLICT(date) DO UPDATE SET
       facts_json = excluded.facts_json,
       updated_at = CURRENT_TIMESTAMP`,
    [facts.date, JSON.stringify(facts)],
  );
  db.close();
}

export function saveReport(report: DailyReport): void {
  const db = connect();
  db.run(
    `INSERT INTO days(date, facts_json, report_json)
     VALUES(?, '{}', ?)
     ON CONFLICT(date) DO UPDATE SET
       report_json = excluded.report_json,
       updated_at = CURRENT_TIMESTAMP`,
    [report.date, JSON.stringify(report)],
  );
  db.close();
}

export function loadFacts(day: string): DayFacts | null {
  const db = connect();
  const row = db.query("SELECT facts_json FROM days WHERE date = ?").get(day) as
    | { facts_json: string }
    | undefined;
  db.close();
  if (!row?.facts_json || row.facts_json === "{}") return null;
  return JSON.parse(row.facts_json) as DayFacts;
}

export function loadReport(day: string): DailyReport | null {
  const db = connect();
  const row = db.query("SELECT report_json FROM days WHERE date = ?").get(day) as
    | { report_json: string | null }
    | undefined;
  db.close();
  if (!row?.report_json) return null;
  return JSON.parse(row.report_json) as DailyReport;
}

export function listDays(): string[] {
  const db = connect();
  const rows = db.query("SELECT date FROM days ORDER BY date DESC").all() as Array<{ date: string }>;
  db.close();
  return rows.map((r) => r.date);
}
