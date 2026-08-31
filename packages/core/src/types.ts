export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
};

export type SessionEvent = {
  tool: string;
  session_id: string;
  project: string | null;
  started_at: string | null;
  ended_at: string | null;
  model: string | null;
  tokens: TokenUsage;
  user_prompts: string[];
  files_touched: string[];
  tools_used: string[];
  title: string | null;
  hours: number;
  windows: Array<{ start: string; end: string }>;
};

export type GitActivity = {
  repo: string;
  commits: number;
  insertions: number;
  deletions: number;
  messages: string[];
  first_at: string | null;
  last_at: string | null;
};

export type CollectorError = {
  tool: string;
  message: string;
};

export type DayFacts = {
  date: string;
  sessions: SessionEvent[];
  git: GitActivity[];
  notes: string[];
  collector_errors: CollectorError[];
};

export type Goal = {
  id: string;
  title: string;
  why: string;
  horizon: string;
  status: "active" | "paused" | "done";
  signals: string[];
};

export type Project = {
  name: string;
  path: string | null;
  goal_ids: string[];
};

export type Identity = {
  name: string;
  north_star: string;
  values: string[];
  goals: Goal[];
  projects: Project[];
  not_doing: string[];
};

export type Settings = {
  timezone: string;
  language: string;
  evening_hour: number;
  llm_base_url: string;
  llm_api_key_env: string;
  llm_model: string;
  extra_git_paths: string[];
};

export type DailyReport = {
  date: string;
  headline: string;
  finished: string[];
  traces: string[];
  do_not_worry: string[];
  tomorrow: string[];
  alignment: string;
  effort_note: string;
  facts_summary: string;
  raw_markdown: string;
};

export type ToolCard = {
  id: string;
  label: string;
  accent: string;
  sessions: number;
  hours: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  titles: string[];
};

export type TimelineItem = {
  tool: string;
  label: string;
  accent: string;
  title: string;
  start: string | null;
  end: string | null;
  hours: number;
  tokens: number;
  project: string | null;
};

export type DashboardPayload = {
  demo: boolean;
  empty?: boolean;
  fallback?: boolean;
  requested?: string;
  date: string;
  identity: {
    name: string;
    north_star: string;
    goals: string[];
  };
  report: DailyReport | null;
  tools: ToolCard[];
  timeline: TimelineItem[];
  git: Array<{
    repo: string;
    commits: number;
    insertions: number;
    deletions: number;
    messages: string[];
  }>;
  totals: {
    sessions: number;
    hours: number;
    tokens: number;
    commits: number;
  };
  collector_errors: CollectorError[];
};

export function emptyTokens(): TokenUsage {
  return { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 };
}

export function addTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_tokens: a.cache_read_tokens + b.cache_read_tokens,
    cache_write_tokens: a.cache_write_tokens + b.cache_write_tokens,
  };
}

export function subTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input_tokens: Math.max(0, a.input_tokens - b.input_tokens),
    output_tokens: Math.max(0, a.output_tokens - b.output_tokens),
    cache_read_tokens: Math.max(0, a.cache_read_tokens - b.cache_read_tokens),
    cache_write_tokens: Math.max(0, a.cache_write_tokens - b.cache_write_tokens),
  };
}

export function totalTokens(t: TokenUsage): number {
  return t.input_tokens + t.output_tokens + t.cache_read_tokens + t.cache_write_tokens;
}

export function emptyIdentity(): Identity {
  return { name: "", north_star: "", values: [], goals: [], projects: [], not_doing: [] };
}

export function defaultSettings(): Settings {
  return {
    timezone: "Asia/Shanghai",
    language: "zh",
    evening_hour: 21,
    llm_base_url: "",
    llm_api_key_env: "WHOAMI_API_KEY",
    llm_model: "",
    extra_git_paths: [],
  };
}

export function emptyFacts(date: string): DayFacts {
  return { date, sessions: [], git: [], notes: [], collector_errors: [] };
}
