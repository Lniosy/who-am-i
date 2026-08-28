# 贡献指南

先用自己的一天跑通：

```bash
pip install -e ".[dev]"
wai init
wai scan
wai today
```

## 最需要的贡献

1. **采集器**：某个工具的本机日志格式变了，或你常用的工具还没接上。
2. **文案**：日报读起来像监工，就需要改。这个项目的语气是产品的一部分。
3. **测试**：用脱敏后的 jsonl 片段做 fixture，不要提交真实会话。
4. **本地 UI**：一个晚上打开的单页就够。

## 新采集器

在 `src/whoami/collectors/` 新增模块，实现：

```python
def collect(day: date) -> list[SessionEvent]:
    ...
```

然后挂到 `collectors/base.py` 的列表里。要求：

- 路径不存在时返回 `[]`
- 解析失败吞掉异常
- 只保留短提示、文件路径、token、时间，不把源码写进 `DayFacts`

## 代码风格

```bash
ruff check src
pytest
```

## 不要做的事

- 把用户会话上传到项目自己的服务器
- 用「效率分数」给人格打分
- 在 README 里承诺官方 API 其实并不存在
