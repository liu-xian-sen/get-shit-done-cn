---
name: gsd:undo
description: "安全的git回退。使用阶段清单和依赖检查回滚阶段或计划的提交。"
argument-hint: "--last N | --phase NN | --plan NN-MM"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
安全的 git 回退——使用阶段清单回滚 GSD 阶段或计划的提交，包含依赖检查和执行前的确认门。

三种模式：
- **--last N**：显示最近的 GSD 提交供交互式选择
- **--phase NN**：回退某个阶段的所有提交（清单 + git log 回退）
- **--plan NN-MM**：回退特定计划的所有提交
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/undo.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
从 @~/.claude/get-shit-done/workflows/undo.md 端到端执行undo工作流。
</process>
