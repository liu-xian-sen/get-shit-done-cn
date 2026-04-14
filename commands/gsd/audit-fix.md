---
type: prompt
name: gsd:audit-fix
description: 自主审计到修复流水线——发现问题、分类、修复、测试、提交
argument-hint: "--source <audit-uat> [--severity <medium|high|all>] [--max N] [--dry-run]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---
<objective>
运行审计，将发现的问题分类为可自动修复和仅限手动修复，然后通过测试验证和原子提交自主修复可自动修复的问题。

标志：
- `--max N` — 最大修复数量（默认：5）
- `--severity high|medium|all` — 处理的最低严重级别（默认：medium）
- `--dry-run` — 仅分类问题不修复（显示分类表）
- `--source <audit>` — 运行哪个审计（默认：audit-uat）
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/audit-fix.md
</execution_context>

<process>
从 @~/.claude/get-shit-done/workflows/audit-fix.md 端到端执行audit-fix工作流。
</process>
