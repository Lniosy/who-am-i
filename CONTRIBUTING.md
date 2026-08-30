# 贡献指南

先用自己的一天跑通：

```bash
bun install
bun run wai init
bun run wai scan
bun run wai today
bun run wai serve          # 浏览器打开 http://127.0.0.1:8787
bun run app                # Tauri 独立窗口
```

## 最需要的贡献

1. **采集器**：某个工具的本机日志格式变了，或你常用的工具还没接上。
2. **文案**：日报读起来像监工，就需要改。这个项目的语气是产品的一部分。
3. **测试**：用脱敏后的 jsonl 片段做 fixture，不要提交真实会话。
4. **桌面窗口**：晚上愿意打开的日报页。

## 新采集器

在 `packages/core/src/collectors/` 新增模块，实现：

```ts
export async function collectXxx(day: string, timeZone: string): Promise<SessionEvent[]>
```

然后挂到 `collectors/index.ts`。要求：

- 路径不存在时返回 `[]`
- 解析失败记进 `collector_errors`，不要让整天毁掉
- 只保留短提示、文件路径、token、时间，不把源码写进 `DayFacts`
- 时长用时间戳聚类，不要用会话首尾墙钟

## 代码风格

```bash
bun test packages/core
```

## 不要做的事

- 把用户会话上传到项目自己的服务器
- 用「效率分数」给人格打分
- 在 README 里承诺官方 API 其实并不存在
