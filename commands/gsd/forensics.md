---
type: prompt
name: gsd:forensics
description: 失败GSD工作流的事后调查——分析git历史、产出物和状态以诊断问题所在
argument-hint: "[problem description]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
调查GSD工作流执行期间出了什么问题。分析git历史、`.planning/` 产出物和文件系统状态以检测异常，并生成结构化的诊断报告。

目的：诊断失败或卡住的工作流，使用户能够理解根本原因并采取纠正措施。
输出：法证报告保存到 `.planning/forensics/`，行内呈现，可选创建 issue。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/forensics.md
</execution_context>

<context>
**数据来源：**
- `git log`（最近的提交、模式、时间间隔）
- `git status` / `git diff`（未提交的工作、冲突）
- `.planning/STATE.md`（当前位置、会话历史）
- `.planning/ROADMAP.md`（阶段范围和进度）
- `.planning/phases/*/`（PLAN.md、SUMMARY.md、VERIFICATION.md、CONTEXT.md）
- `.planning/reports/SESSION_REPORT.md`（上次会话结果）

**用户输入：**
- 问题描述：$ARGUMENTS（可选——如未提供会询问）
</context>

<process>
读取并从 @~/.claude/get-shit-done/workflows/forensics.md 端到端执行forensics工作流。
</process>

<success_criteria>
- 从所有可用数据源收集证据
- 至少检查 4 种异常类型（卡住循环、缺失产出物、废弃工作、崩溃/中断）
- 结构化法证报告写入 `.planning/forensics/report-{timestamp}.md`
- 报告行内呈现，包含发现、异常和建议
- 提供交互式调查以进行更深入分析
- 如果存在可操作的发现，提供创建 GitHub issue
</success_criteria>

<critical_rules>
- **只读调查：** 在法证分析期间不要修改项目源文件。仅写入法证报告和更新 STATE.md 会话跟踪。
- **脱敏敏感数据：** 从报告和 issue 中去除绝对路径、API 密钥、令牌。
- **以证据为基础：** 每个异常必须引用具体的提交、文件或状态数据。
- **无证据不猜测：** 如果数据不足，明确说明——不要编造根本原因。
</critical_rules>
