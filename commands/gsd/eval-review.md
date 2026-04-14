---
name: gsd:eval-review
description: 回顾性审计已执行的AI阶段的评估覆盖率——对每个评估维度评分为COVERED/PARTIAL/MISSING，并生成包含补救计划的可操作EVAL-REVIEW.md
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
对已完成的AI阶段进行回顾性评估覆盖率审计。
检查 AI-SPEC.md 中的评估策略是否已实施。
生成 EVAL-REVIEW.md，包含评分、裁定、差距和补救计划。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/eval-review.md
@~/.claude/get-shit-done/references/ai-evals.md
</execution_context>

<context>
阶段：$ARGUMENTS — 可选，默认为最后完成的阶段。
</context>

<process>
从 @~/.claude/get-shit-done/workflows/eval-review.md 端到端执行。
保留所有工作流门。
</process>
