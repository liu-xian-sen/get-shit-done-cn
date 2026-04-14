---
name: gsd:manager
description: 用于从单个终端管理多个阶段的交互式命令中心
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill
  - Task
---
<objective>
管理里程碑的单终端命令中心。显示所有阶段的仪表板及可视状态指示器，推荐最优的下一步操作，并分发工作——讨论在行内运行，计划/执行作为后台代理运行。

专为需要从一个终端跨阶段并行化工作的高级用户设计：在另一个阶段在后台规划或执行时讨论某个阶段。

**创建/更新：**
- 不直接创建文件——通过 Skill() 和后台 Task 代理分发到现有 GSD 命令。
- 读取 `.planning/STATE.md`、`.planning/ROADMAP.md`、阶段目录以获取状态。

**之后：** 用户在管理完成后退出，或所有阶段完成时建议里程碑生命周期。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/manager.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
不需要参数。需要一个包含 ROADMAP.md 和 STATE.md 的活跃里程碑。

项目上下文、阶段列表、依赖关系和推荐在工作流内部使用 `gsd-tools.cjs init manager` 解析。不需要预先加载上下文。
</context>

<process>
从 @~/.claude/get-shit-done/workflows/manager.md 端到端执行manager工作流。
维持仪表板刷新循环，直到用户退出或所有阶段完成。
</process>
