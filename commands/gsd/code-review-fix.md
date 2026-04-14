---
name: gsd:code-review-fix
description: 自动修复代码审查在REVIEW.md中发现的问题。派生修复代理，原子提交每个修复，生成REVIEW-FIX.md摘要。
argument-hint: "<phase-number> [--all] [--auto]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - Task
---
<objective>
自动修复代码审查发现的问题。读取指定阶段的 REVIEW.md，派生 gsd-code-fixer 代理应用修复，并生成 REVIEW-FIX.md 摘要。

参数：
- 阶段编号（必需）— 要修复哪个阶段的 REVIEW.md（例如 "2" 或 "02"）
- `--all`（可选）— 将 Info 级别发现纳入修复范围（默认：仅 Critical + Warning）
- `--auto`（可选）— 启用修复 + 重新审查迭代循环，上限为 3 次迭代

输出：阶段目录中的 {padded_phase}-REVIEW-FIX.md + 已应用修复的行内摘要
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/code-review-fix.md
</execution_context>

<context>
阶段：$ARGUMENTS（第一个位置参数是阶段编号）

从 $ARGUMENTS 解析的可选标志：
- `--all` — 将 Info 级别发现纳入修复范围。默认行为仅修复 Critical + Warning。
- `--auto` — 启用修复 + 重新审查迭代循环。应用修复后，以相同深度重新运行代码审查。如果发现新问题，继续迭代。总计上限为 3 次迭代。不使用此标志时，仅执行单次修复。

上下文文件（CLAUDE.md、REVIEW.md、阶段状态）在工作流内部通过 `gsd-tools init phase-op` 解析，并通过配置块委派给代理。
</context>

<process>
此命令是一个轻量级分发层。它解析参数并委派给工作流。

从 @~/.claude/get-shit-done/workflows/code-review-fix.md 端到端执行code-review-fix工作流。

工作流（而非此命令）强制执行以下门：
- 阶段验证（在配置门之前）
- 配置门检查（workflow.code_review）
- REVIEW.md 存在性检查（如果缺失则报错）
- REVIEW.md 状态检查（如果 clean/skipped 则跳过）
- 代理派生（gsd-code-fixer）
- 迭代循环（如果使用 --auto，上限为 3 次迭代）
- 结果呈现（行内摘要 + 后续步骤）
</process>
