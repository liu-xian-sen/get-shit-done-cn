---
name: gsd:analyze-dependencies
description: 分析阶段依赖关系并为ROADMAP.md建议"Depends on"条目
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<objective>
分析当前里程碑的阶段依赖图。对于每对阶段，根据以下条件判断是否存在依赖关系：
- 文件重叠（修改相同文件的阶段必须排序）
- 语义依赖（使用另一个阶段构建的API的阶段）
- 数据流（消费另一个阶段输出的阶段）

然后建议对 ROADMAP.md 进行 `Depends on` 更新。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/analyze-dependencies.md
</execution_context>

<context>
不需要参数。需要一个包含 ROADMAP.md 的活跃里程碑。

在执行 `/gsd-manager` 之前运行此命令，以填补缺失的 `Depends on` 字段并防止无序并行执行导致的合并冲突。
</context>

<process>
从 @~/.claude/get-shit-done/workflows/analyze-dependencies.md 端到端执行analyze-dependencies工作流。
清晰地呈现依赖建议，并将确认的更新应用到 ROADMAP.md。
</process>
