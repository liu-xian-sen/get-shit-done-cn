---
name: gsd:scan
description: 快速代码库评估——/gsd-map-codebase的轻量级替代方案
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---
<objective>
对单个区域运行聚焦的代码库扫描，在 `.planning/codebase/` 中生成有针对性的文档。
接受可选的 `--focus` 标志：`tech`、`arch`、`quality`、`concerns` 或 `tech+arch`（默认）。

`/gsd-map-codebase` 的轻量级替代方案——派生一个映射代理而非四个并行代理。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/scan.md
</execution_context>

<process>
从 @~/.claude/get-shit-done/workflows/scan.md 端到端执行scan工作流。
</process>
