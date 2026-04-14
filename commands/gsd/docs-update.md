---
name: gsd:docs-update
description: 生成或更新经过代码库验证的项目文档
argument-hint: "[--force] [--verify-only]"
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
为当前项目生成和更新最多 9 个文档文件。每种文档类型由一个 gsd-doc-writer 子代理编写，该子代理直接探索代码库——不会出现虚构路径、虚假端点或过时签名。

标志处理规则：
- 以下记录的可选标志是可用行为，而非隐含的活跃行为
- 标志仅在其字面标记出现在 `$ARGUMENTS` 中时才处于活跃状态
- 如果记录的标志不在 `$ARGUMENTS` 中，则视为非活跃
- `--force`：跳过保留提示，无论现有内容或 GSD 标记如何都重新生成所有文档
- `--verify-only`：检查现有文档与代码库的准确性，不生成（完整验证需要第 4 阶段验证器）
- 如果 `--force` 和 `--verify-only` 同时出现在 `$ARGUMENTS` 中，`--force` 优先
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/docs-update.md
</execution_context>

<context>
参数：$ARGUMENTS

**可用的可选标志（仅文档说明——不会自动激活）：**
- `--force` — 重新生成所有文档。覆盖手写文档和 GSD 文档。无保留提示。
- `--verify-only` — 检查现有文档与代码库的准确性。不写入文件。报告 VERIFY 标记计数。完整的代码库事实核查需要 gsd-doc-verifier 代理（第 4 阶段）。

**活跃标志必须从 `$ARGUMENTS` 推导：**
- `--force` 仅在 `$ARGUMENTS` 中存在字面 `--force` 标记时才活跃
- `--verify-only` 仅在 `$ARGUMENTS` 中存在字面 `--verify-only` 标记时才活跃
- 如果两个标记都不存在，运行标准的完整阶段生成流程
- 不要仅因为标志在此提示中有记录就推断其处于活跃状态
</context>

<process>
从 @~/.claude/get-shit-done/workflows/docs-update.md 端到端执行docs-update工作流。
保留所有工作流门（保留检查、标志处理、波次执行、单仓库分发、提交、报告）。
</process>
