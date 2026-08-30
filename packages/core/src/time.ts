export function parseTs(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    if (/^\d+(\.\d+)?$/.test(text)) return parseTs(Number(text));
    const d = new Date(text.endsWith("Z") || /[+-]\d\d:\d\d$/.test(text) ? text : text);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function dayKey(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

export function onDay(ts: Date | null, day: string, timeZone: string): boolean {
  if (!ts) return false;
  return dayKey(ts, timeZone) === day;
}

export function todayKey(timeZone: string): string {
  return dayKey(new Date(), timeZone);
}

export function parseDay(raw: string | undefined | null, timeZone: string): string {
  if (!raw) return todayKey(timeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`日期格式应为 YYYY-MM-DD，收到：${raw}`);
  }
  return raw;
}

export function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

const DEFAULT_GAP_MS = 8 * 60 * 1000;

export type Window = { start: Date; end: Date; hours: number };

export function clusterTimestamps(timestamps: Date[], gapMs = DEFAULT_GAP_MS): Window[] {
  if (!timestamps.length) return [];
  const ts = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
  const clusters: Array<{ start: Date; end: Date }> = [];
  let start = ts[0];
  let end = ts[0];
  for (const t of ts.slice(1)) {
    if (t.getTime() - end.getTime() > gapMs) {
      clusters.push({ start, end });
      start = t;
    }
    end = t;
  }
  clusters.push({ start, end });
  return clusters.map((c) => {
    const span = Math.max(c.end.getTime() - c.start.getTime(), 60_000);
    return { start: c.start, end: new Date(c.start.getTime() + span), hours: span / 3_600_000 };
  });
}

export function mergeHours(windows: Array<{ start: Date; end: Date }>): number {
  const sorted = windows
    .filter((w) => w.end.getTime() > w.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (!sorted.length) return 0;
  let total = 0;
  let curS = sorted[0].start;
  let curE = sorted[0].end;
  for (const w of sorted.slice(1)) {
    if (w.start.getTime() > curE.getTime()) {
      total += curE.getTime() - curS.getTime();
      curS = w.start;
      curE = w.end;
    } else if (w.end.getTime() > curE.getTime()) {
      curE = w.end;
    }
  }
  total += curE.getTime() - curS.getTime();
  return total / 3_600_000;
}

export function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}
