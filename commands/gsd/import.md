---
name: gsd:import
description: 导入外部计划并在写入之前对项目决策进行冲突检测。
argument-hint: "--from <filepath>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
将外部计划文件导入 GSD 规划系统，并对 PROJECT.md 决策进行冲突检测。

- **--from**：导入外部计划文件，检测冲突，写入为 GSD PLAN.md，通过 gsd-plan-checker 验证。

未来：`--prd` 模式用于 PRD 提取，计划在后续 PR 中实现。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/import.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
端到端执行import工作流。
</process>
