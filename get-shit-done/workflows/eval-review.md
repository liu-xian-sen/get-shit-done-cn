<purpose>
对已实现的 AI 阶段的评估覆盖率进行事后审计。适用于任何 GSD 管理的 AI 阶段的独立命令。生成一份带有差距分析和补救计划的评分 EVAL-REVIEW.md。

在 /gsd-execute-phase 之后使用，以验证 AI-SPEC.md 中的评估策略是否已实际实现。与 /gsd-ui-review 和 /gsd-validate-phase 的模式相同。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ai-evals.md
</required_reading>

<process>

## 0. 初始化

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析：`phase_dir`、`phase_number`、`phase_name`、`phase_slug`、`padded_phase`、`commit_docs`。

```bash
AUDITOR_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-eval-auditor --raw)
```

显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 评估审计 — 阶段 {N}：{name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. 检测输入状态

```bash
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
EVAL_REVIEW_FILE=$(ls "${PHASE_DIR}"/*-EVAL-REVIEW.md 2>/dev/null | head -1)
```

**状态 A** — AI-SPEC.md + SUMMARY.md 均存在：针对规范进行完整审计
**状态 B** — SUMMARY.md 存在，无 AI-SPEC.md：针对通用最佳实践审计
**状态 C** — 无 SUMMARY.md：退出——"阶段 {N} 未执行。请先运行 /gsd-execute-phase {N}。"


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 标志）：** 如果 `$ARGUMENTS` 中存在 `--text` 或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 TEXT_MODE 激活时，将每次 `AskUserQuestion` 调用替换为纯文本编号列表，并请用户键入选择编号。这对于 `AskUserQuestion` 不可用的非 Claude 运行时（OpenAI Codex、Gemini CLI 等）是必需的。
**如果 `EVAL_REVIEW_FILE` 非空：** 使用 AskUserQuestion：
- header: "现有评估审查"
- question: "阶段 {N} 的 EVAL-REVIEW.md 已存在。"
- options:
  - "重新审计——运行新的审计"
  - "查看——显示当前审查并退出"

如果"查看"：显示文件，退出。
如果"重新审计"：继续。

**如果是状态 B（无 AI-SPEC.md）：** 警告：
```
未找到阶段 {N} 的 AI-SPEC.md。
审计将针对通用 AI 评估最佳实践进行，而非阶段特定计划。
下次考虑在实现前运行 /gsd-ai-integration-phase {N}。
```
继续（非阻塞）。

## 2. 收集上下文路径

为审计器构建文件列表：
- AI-SPEC.md（如果存在——计划的评估策略）
- 阶段目录中的所有 SUMMARY.md 文件
- 阶段目录中的所有 PLAN.md 文件

## 3. 生成 gsd-eval-auditor

```
◆ 正在生成评估审计器...
```

构建提示：

```markdown
读取 ~/.claude/agents/gsd-eval-auditor.md 以获取指令。

<objective>
对阶段 {phase_number}：{phase_name} 进行评估覆盖率审计
{如果 AI-SPEC 存在："针对 AI-SPEC.md 评估计划进行审计。"}
{如果无 AI-SPEC："针对通用 AI 评估最佳实践进行审计。"}
</objective>

<files_to_read>
- {summary_paths}
- {plan_paths}
- {ai_spec_path（如果存在）}
</files_to_read>

<input>
ai_spec_path: {ai_spec_path 或 "none"}
phase_dir: {phase_dir}
phase_number: {phase_number}
phase_name: {phase_name}
padded_phase: {padded_phase}
state: {A 或 B}
</input>
```

使用模型 `AUDITOR_MODEL` 作为 Task 生成。

## 4. 解析审计器结果

读取已写入的 EVAL-REVIEW.md。提取：
- `overall_score`
- `verdict`（生产就绪 | 需要改进 | 存在重大差距 | 未实现）
- `critical_gap_count`

## 5. 显示摘要

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 评估审计完成 — 阶段 {N}：{name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 得分：{overall_score}/100
◆ 结论：{verdict}
◆ 关键差距：{critical_gap_count}
◆ 输出：{eval_review_path}

{如果生产就绪：}
  下一步：/gsd-plan-phase（下一阶段）或部署

{如果需要改进：}
  解决 EVAL-REVIEW.md 中的关键差距，然后重新运行 /gsd-eval-review {N}

{如果存在重大差距或未实现：}
  查看 AI-SPEC.md 评估计划。关键评估维度未实现。
  在解决差距之前不要部署。
```

## 6. 提交

**如果 `commit_docs` 为 true：**
```bash
git add "${EVAL_REVIEW_FILE}"
git commit -m "docs({phase_slug}): add EVAL-REVIEW.md — score {overall_score}/100 ({verdict})"
```

</process>

<success_criteria>
- [ ] 阶段执行状态已正确检测
- [ ] AI-SPEC.md 的存在已处理（有或无）
- [ ] gsd-eval-auditor 已使用正确上下文生成
- [ ] EVAL-REVIEW.md 已写入（由审计器）
- [ ] 得分和结论已向用户显示
- [ ] 基于结论呈现了适当的后续步骤
- [ ] 如果 commit_docs 启用，已提交
</success_criteria>
