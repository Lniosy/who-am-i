#!/usr/bin/env bun
import {
  collectAndReport,
  configDir,
  dataDir,
  identityPath,
  initIdentity,
  initSettings,
  loadIdentity,
  reportsDir,
  scanDay,
  settingsPath,
  totalTokens,
} from "@whoami/core";
import { serve } from "./server";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0) return process.argv[i + 1];
  const pref = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : undefined;
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

const cmd = process.argv[2] || "help";

if (cmd === "help" || cmd === "-h" || cmd === "--help") {
  console.log(`Who Am I — 看清自己每天在做什么，而不是被工具用量追着跑。

命令：
  wai init              生成本机说明书和设置
  wai scan [--day DATE] 只采集，不生成日报
  wai today [--day DATE] 采集并写出日报
  wai payload [--day DATE] [--demo]  输出面板 JSON
  wai who               读你写下的自己
  wai paths             显示本机数据目录
  wai serve [--host] [--port]  本机 HTTP 面板
  wai version
`);
  process.exit(0);
}

if (cmd === "version") {
  console.log("0.1.0");
  process.exit(0);
}

if (cmd === "init") {
  const ident = initIdentity();
  const sett = initSettings();
  console.log(`自我说明书：${ident}`);
  console.log(`设置文件：  ${sett}`);
  console.log("先编辑 identity.yaml，写清你想成为什么样的人、正在追什么。");
  process.exit(0);
}

if (cmd === "paths") {
  console.log(`config   ${configDir()}`);
  console.log(`data     ${dataDir()}`);
  console.log(`reports  ${reportsDir()}`);
  console.log(`identity ${identityPath()}`);
  console.log(`settings ${settingsPath()}`);
  process.exit(0);
}

if (cmd === "who") {
  const path = identityPath();
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.log("还没有自我说明书。先运行：wai init");
    process.exit(1);
  }
  const ident = loadIdentity();
  console.log(ident.name || "未署名");
  if (ident.north_star) console.log(ident.north_star);
  if (ident.goals.length) {
    console.log("\n目标：");
    for (const g of ident.goals) console.log(`  [${g.status}] ${g.title} — ${g.why}`);
  }
  if (ident.not_doing.length) {
    console.log("\n明确不做什么：");
    for (const x of ident.not_doing) console.log(`  - ${x}`);
  }
  process.exit(0);
}

if (cmd === "scan") {
  const facts = await scanDay(arg("--day")).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
  const { saveFacts } = await import("@whoami/core");
  saveFacts(facts);
  console.log(`Who Am I 采集 ${facts.date}`);
  if (!facts.sessions.length) {
    console.log("今天还没有读到 AI 工具痕迹。确认 Claude Code / Codex / Grok / Cursor 已在本机用过。");
  }
  for (const s of facts.sessions) {
    console.log(
      `  ${s.tool.padEnd(12)} ${(s.project || "-").slice(0, 24).padEnd(24)} ${String(totalTokens(s.tokens)).padStart(10)}  ${(s.title || "").slice(0, 60)}`,
    );
  }
  if (facts.git.length) {
    console.log("Git");
    for (const g of facts.git) {
      console.log(`  ${g.repo}  ${g.commits}  ${(g.messages[0] || "-").slice(0, 60)}`);
    }
  }
  if (facts.collector_errors.length) {
    console.log("采集警告：");
    for (const e of facts.collector_errors) console.log(`  ${e.tool}: ${e.message}`);
  }
  process.exit(0);
}

if (cmd === "today") {
  const report = await collectAndReport(arg("--day")).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
  console.log(report.raw_markdown);
  console.log(`已写入 ${reportsDir()}/${report.date}.md`);
  process.exit(0);
}

if (cmd === "payload") {
  const { dayPayload } = await import("@whoami/core");
  const data = await dayPayload(arg("--day"), has("--demo")).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
  console.log(JSON.stringify(data));
  process.exit(0);
}

if (cmd === "serve") {
  const host = arg("--host") || "127.0.0.1";
  const port = Number(arg("--port") || "8787");
  await serve(host, port);
} else {
  console.error(`未知命令：${cmd}。wai help`);
  process.exit(1);
}
