import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { defaultSettings, type Settings } from "./types";
import { settingsPath } from "./paths";

export const DEFAULT_SETTINGS = `# Who Am I 设置（本机）
timezone: Asia/Shanghai
language: zh
evening_hour: 21

# 可选：用来写日报的模型。留空则用规则模板，不调用任何网络。
# 兼容 OpenAI / Ollama / 任何 OpenAI-compatible 接口。
llm_base_url: ""          # 例如 http://127.0.0.1:11434/v1 或 https://api.x.ai/v1
llm_api_key_env: WHOAMI_API_KEY
llm_model: ""             # 例如 grok-4、llama3.1、gpt-4.1-mini

extra_git_paths: []
`;

export function loadSettings(path = settingsPath()): Settings {
  const base = defaultSettings();
  if (!existsSync(path)) return base;
  const data = parseYaml(readFileSync(path, "utf8")) ?? {};
  const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    timezone: typeof rec.timezone === "string" && rec.timezone ? rec.timezone : base.timezone,
    language: typeof rec.language === "string" && rec.language ? rec.language : base.language,
    evening_hour: typeof rec.evening_hour === "number" ? rec.evening_hour : base.evening_hour,
    llm_base_url: typeof rec.llm_base_url === "string" ? rec.llm_base_url : "",
    llm_api_key_env:
      typeof rec.llm_api_key_env === "string" && rec.llm_api_key_env
        ? rec.llm_api_key_env
        : base.llm_api_key_env,
    llm_model: typeof rec.llm_model === "string" ? rec.llm_model : "",
    extra_git_paths: Array.isArray(rec.extra_git_paths)
      ? rec.extra_git_paths.filter((x) => typeof x === "string")
      : [],
  };
}

export function initSettings(force = false): string {
  const p = settingsPath();
  if (existsSync(p) && !force) return p;
  writeFileSync(p, DEFAULT_SETTINGS);
  return p;
}
