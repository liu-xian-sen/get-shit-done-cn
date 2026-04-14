---
type: prompt
name: gsd:milestone-summary
description: 从里程碑产出物生成综合项目摘要，用于团队入职和评审
argument-hint: "[version]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
为团队入职和项目评审生成结构化的里程碑摘要。读取已完成的里程碑产出物（ROADMAP、REQUIREMENTS、CONTEXT、SUMMARY、VERIFICATION 文件），并生成关于构建了什么、如何构建以及为什么构建的人性化概览。

目的：使新团队成员能够通过阅读一份文档和提问后续问题来了解已完成的项目。
输出：MILESTONE_SUMMARY 写入 `.planning/reports/`，行内呈现，可选交互式问答。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/milestone-summary.md
</execution_context>

<context>
**项目文件：**
- `.planning/ROADMAP.md`
- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/RETROSPECTIVE.md`
- `.planning/milestones/v{version}-ROADMAP.md`（如果已归档）
- `.planning/milestones/v{version}-REQUIREMENTS.md`（如果已归档）
- `.planning/phases/*-*/`（SUMMARY.md、VERIFICATION.md、CONTEXT.md、RESEARCH.md）

**用户输入：**
- 版本：$ARGUMENTS（可选——默认为当前/最新里程碑）
</context>

<process>
读取并从 @~/.claude/get-shit-done/workflows/milestone-summary.md 端到端执行milestone-summary工作流。
</process>

<success_criteria>
- 里程碑版本已解析（来自参数、STATE.md 或归档扫描）
- 所有可用产出物已读取（ROADMAP、REQUIREMENTS、CONTEXT、SUMMARY、VERIFICATION、RESEARCH、RETROSPECTIVE）
- 摘要文档写入 `.planning/reports/MILESTONE_SUMMARY-v{version}.md`
- 所有 7 个章节已生成（概览、架构、阶段、决策、需求、技术债务、入门指南）
- 摘要行内呈现给用户
- 提供交互式问答
- STATE.md 已更新
</success_criteria>
