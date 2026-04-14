---
name: gsd:secure-phase
description: 回顾性验证已完成阶段的威胁缓解措施
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
验证已完成阶段的威胁缓解措施。三种状态：
- (A) SECURITY.md 存在——审计并验证缓解措施
- (B) 无 SECURITY.md，存在包含威胁模型的 PLAN.md——从产出物运行
- (C) 阶段未执行——退出并提供指引

输出：更新后的 SECURITY.md。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/secure-phase.md
</execution_context>

<context>
阶段：$ARGUMENTS — 可选，默认为最后完成的阶段。
</context>

<process>
执行 @~/.claude/get-shit-done/workflows/secure-phase.md。
保留所有工作流门。
</process>
