---
name: gsd:code-review
description: 审查阶段中修改的源文件，检查Bug、安全问题和代码质量问题
argument-hint: "<phase-number> [--depth=quick|standard|deep] [--files file1,file2,...]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---
<objective>
审查阶段中修改的源文件，检查Bug、安全漏洞和代码质量问题。

派生 gsd-code-reviewer 代理以指定深度级别分析代码。在阶段目录中生成 REVIEW.md 产出物，包含按严重性分类的发现。

参数：
- 阶段编号（必需）— 审查哪个阶段的变更（例如 "2" 或 "02"）
- `--depth=quick|standard|deep`（可选）— 审查深度级别，覆盖 workflow.code_review_depth 配置
  - quick：仅模式匹配（约 2 分钟）
  - standard：按文件分析，包含语言特定检查（约 5-15 分钟，默认）
  - deep：跨文件分析，包括导入图和调用链（约 15-30 分钟）
- `--files file1,file2,...`（可选）— 显式的逗号分隔文件列表，跳过 SUMMARY/git 范围界定（文件范围界定的最高优先级）

输出：阶段目录中的 {padded_phase}-REVIEW.md + 发现的行内摘要
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/code-review.md
</execution_context>

<context>
阶段：$ARGUMENTS（第一个位置参数是阶段编号）

从 $ARGUMENTS 解析的可选标志：
- `--depth=VALUE` — 深度覆盖（quick|standard|deep）。如果提供，覆盖 workflow.code_review_depth 配置。
- `--files=file1,file2,...` — 显式文件列表覆盖。根据 D-08 具有文件范围界定的最高优先级。提供时，工作流完全跳过 SUMMARY.md 提取和 git diff 回退。

上下文文件（CLAUDE.md、SUMMARY.md、阶段状态）在工作流内部通过 `gsd-tools init phase-op` 解析，并通过 `<files_to_read>` 块委派给代理。
</context>

<process>
此命令是一个轻量级分发层。它解析参数并委派给工作流。

从 @~/.claude/get-shit-done/workflows/code-review.md 端到端执行code-review工作流。

工作流（而非此命令）强制执行以下门：
- 阶段验证（在配置门之前）
- 配置门检查（workflow.code_review）
- 文件范围界定（--files 覆盖 > SUMMARY.md > git diff 回退）
- 空范围检查（如果没有文件则跳过）
- 代理派生（gsd-code-reviewer）
- 结果呈现（行内摘要 + 后续步骤）
</process>
