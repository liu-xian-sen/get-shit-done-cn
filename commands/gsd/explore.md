---
name: gsd:explore
description: 苏格拉底式构思和创意路由——在提交计划之前深入思考创意
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---
<objective>
开放式苏格拉底构思会话。通过探究性问题引导开发者探索创意，
可选派生研究，然后将输出路由到适当的 GSD 产出物（笔记、待办事项、种子、研究问题、需求或新阶段）。

接受可选的主题参数：`/gsd-explore authentication strategy`
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/explore.md
</execution_context>

<process>
从 @~/.claude/get-shit-done/workflows/explore.md 端到端执行explore工作流。
</process>
