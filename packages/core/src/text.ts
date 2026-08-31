export function clip(text: string, limit = 160): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return compact.slice(0, limit - 1) + "…";
}

export function asText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => asText(item)).filter(Boolean).join(" ");
  }
  if (content && typeof content === "object") {
    const rec = content as Record<string, unknown>;
    return asText(rec.text ?? rec.content ?? rec.prompt ?? "");
  }
  return "";
}

export function displayProject(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep */
  }
  s = s.replace(/^-+/, "");
  const stripped = s
    .replace(/^Users-[^-]+-Documents-/, "")
    .replace(/^Users-[^-]+-/, "")
    .replace(/^home-[^-]+-/, "");
  if (stripped && stripped !== s) s = stripped;
  const segs = s.split(/[/\\]/).filter(Boolean);
  return segs.at(-1) || s;
}

export function isJunkTitle(text: string): boolean {
  const s = text.trim();
  if (!s) return true;
  if (/^[0-9a-f-]{20,}$/i.test(s)) return true;
  if (s.includes("%2F") || s.startsWith("/Users/") || s.startsWith("/home/")) return true;
  if (/AGENTS\.md|<INSTRUCTIONS>|<user_info>|<git_status>|<rules>/.test(s)) return true;
  if (s.startsWith("<") && s.includes(">")) return true;
  if (s.length > 220 && s.includes("# ")) return true;
  return false;
}

export function pickTitle(prompts: string[], fallback: string): string {
  const clean = prompts.filter((p) => !isJunkTitle(p));
  const human = clean.filter((p) => !p.startsWith("Automation:"));
  const pick = human[0] || clean[0];
  return pick ? clip(pick, 80) : fallback;
}

export function intish(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return 0;
}
