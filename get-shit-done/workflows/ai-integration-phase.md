<purpose>
为涉及构建 AI 系统的阶段生成 AI 设计契约（AI-SPEC.md）。编排 gsd-framework-selector → gsd-ai-researcher → gsd-domain-researcher → gsd-eval-planner，并设有验证关卡。在 GSD 生命周期中，插入 discuss-phase 和 plan-phase 之间。

AI-SPEC.md 在规划者创建任务之前锁定四个要素：
1. 框架选择（含理由和备选方案）
2. 实现指导（来自官方文档的正确语法、模式、陷阱）
3. 领域上下文（实践者评估标准要素、失败模式、监管约束）
4. 评估策略（维度、评分标准、工具、参考数据集、护栏）

这可防止两种最常见的 AI 开发失败：为用例选错框架，以及将评估视为事后补救。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ai-frameworks.md
@~/.claude/get-shit-done/references/ai-evals.md
</required_reading>

<process>

## 1. 初始化

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，获取：`phase_dir`、`phase_number`、`phase_name`、`phase_slug`、`padded_phase`、`has_context`、`has_research`、`commit_docs`。

**文件路径：** `state_path`、`roadmap_path`、`requirements_path`、`context_path`。

解析 agent 模型：
```bash
SELECTOR_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-framework-selector --raw)
RESEARCHER_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-ai-researcher --raw)
DOMAIN_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-domain-researcher --raw)
PLANNER_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-eval-planner --raw)
```

检查配置：
```bash
AI_PHASE_ENABLED=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.ai_integration_phase 2>/dev/null || echo "true")
```

**如果 `AI_PHASE_ENABLED` 为 `false`：**
```
AI 阶段在配置中已禁用。通过 /gsd-settings 启用。
```
退出工作流。

**如果 `planning_exists` 为 false：** 报错 — 请先运行 `/gsd-new-project`。

## 2. 解析并验证阶段

从 $ARGUMENTS 中提取阶段编号。如果未提供，自动检测下一个未规划的阶段。

```bash
PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
```

**如果 `found` 为 false：** 报错并列出可用阶段。

## 3. 检查前提条件

**如果 `has_context` 为 false：**
```
未找到第 {N} 阶段的 CONTEXT.md。
建议：先运行 /gsd-discuss-phase {N} 以记录框架偏好。
继续执行（无用户决策）— 框架选择器将询问所有问题。
```
继续（非阻塞）。

## 4. 检查现有 AI-SPEC

```bash
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
```


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 标志）：** 如果 `$ARGUMENTS` 中存在 `--text` 或初始化 JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当文本模式激活时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对于不支持 `AskUserQuestion` 的非 Claude 运行时（OpenAI Codex、Gemini CLI 等）是必需的。
**如果存在：** 使用 AskUserQuestion：
- header: "现有 AI-SPEC"
- question: "第 {N} 阶段的 AI-SPEC.md 已存在。您希望如何处理？"
- options:
  - "更新 — 以现有内容为基础重新运行"
  - "查看 — 显示当前 AI-SPEC 并退出"
  - "跳过 — 保留当前 AI-SPEC 并退出"

如果选择"查看"：显示文件内容，退出。
如果选择"跳过"：退出。
如果选择"更新"：继续到步骤 5。

## 5. 启动 gsd-framework-selector

显示：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AI 设计契约 — 第 {N} 阶段：{name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 步骤 1/4 — 框架选择...
```

启动 `gsd-framework-selector`，传入：
```markdown
阅读 ~/.claude/agents/gsd-framework-selector.md 获取说明。

<objective>
为第 {phase_number} 阶段：{phase_name} 选择合适的 AI 框架
目标：{phase_goal}
</objective>

<files_to_read>
{context_path（如存在）}
{requirements_path（如存在）}
</files_to_read>

<phase_context>
阶段：{phase_number} — {phase_name}
目标：{phase_goal}
</phase_context>
```

解析选择器输出，获取：`primary_framework`、`system_type`、`model_provider`、`eval_concerns`、`alternative_framework`。

**如果选择器失败或返回空值：** 报错退出 — "框架选择失败。请重新运行 /gsd-ai-integration-phase {N}，或先在 /gsd-discuss-phase {N} 中回答框架问题。"

## 6. 初始化 AI-SPEC.md

复制模板：
```bash
cp "$HOME/.claude/get-shit-done/templates/AI-SPEC.md" "${PHASE_DIR}/${PADDED_PHASE}-AI-SPEC.md"
```

填写标题字段：
- 阶段编号和名称
- 系统分类（来自选择器）
- 已选框架（来自选择器）
- 已考虑的备选方案（来自选择器）

## 7. 启动 gsd-ai-researcher

显示：
```
◆ 步骤 2/4 — 研究 {primary_framework} 文档及 AI 系统最佳实践...
```

启动 `gsd-ai-researcher`，传入：
```markdown
阅读 ~/.claude/agents/gsd-ai-researcher.md 获取说明。

<objective>
为第 {phase_number} 阶段：{phase_name} 研究 {primary_framework}
撰写 AI-SPEC.md 第 3 节和第 4 节
</objective>

<files_to_read>
{ai_spec_path}
{context_path（如存在）}
</files_to_read>

<input>
framework: {primary_framework}
system_type: {system_type}
model_provider: {model_provider}
ai_spec_path: {ai_spec_path}
phase_context: 第 {phase_number} 阶段：{phase_name} — {phase_goal}
</input>
```

## 8. 启动 gsd-domain-researcher

显示：
```
◆ 步骤 3/4 — 研究领域上下文和专家评估标准...
```

启动 `gsd-domain-researcher`，传入：
```markdown
阅读 ~/.claude/agents/gsd-domain-researcher.md 获取说明。

<objective>
为第 {phase_number} 阶段：{phase_name} 研究业务领域和专家评估标准
撰写 AI-SPEC.md 第 1b 节（领域上下文）
</objective>

<files_to_read>
{ai_spec_path}
{context_path（如存在）}
{requirements_path（如存在）}
</files_to_read>

<input>
system_type: {system_type}
phase_name: {phase_name}
phase_goal: {phase_goal}
ai_spec_path: {ai_spec_path}
</input>
```

## 9. 启动 gsd-eval-planner

显示：
```
◆ 步骤 4/4 — 基于领域和技术上下文设计评估策略...
```

启动 `gsd-eval-planner`，传入：
```markdown
阅读 ~/.claude/agents/gsd-eval-planner.md 获取说明。

<objective>
为第 {phase_number} 阶段：{phase_name} 设计评估策略
撰写 AI-SPEC.md 第 5、6、7 节
AI-SPEC.md 现已包含领域上下文（第 1b 节）— 以其作为评估标准起点。
</objective>

<files_to_read>
{ai_spec_path}
{context_path（如存在）}
{requirements_path（如存在）}
</files_to_read>

<input>
system_type: {system_type}
framework: {primary_framework}
model_provider: {model_provider}
phase_name: {phase_name}
phase_goal: {phase_goal}
ai_spec_path: {ai_spec_path}
</input>
```

## 10. 验证 AI-SPEC 完整性

读取已完成的 AI-SPEC.md，检查：
- 第 2 节含有框架名称（非占位符）
- 第 1b 节至少有一个领域评估标准要素（好/差/风险）
- 第 3 节有非空代码块（入口点模式）
- 第 4b 节有 Pydantic 示例
- 第 5 节的维度表格至少有一行
- 第 6 节至少有一个护栏，或明确注明"内部工具，不适用"
- 末尾清单部分至少勾选了 3 个以上条目

**如果验证失败：** 显示具体缺失的节。询问用户是否要重新运行特定步骤或继续。

## 11. 提交

**如果 `commit_docs` 为 true：**
```bash
git add "${AI_SPEC_FILE}"
git commit -m "docs({phase_slug}): generate AI-SPEC.md — {primary_framework} + domain context + eval strategy"
```

## 12. 显示完成信息

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AI-SPEC 完成 — 第 {N} 阶段：{name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 框架：{primary_framework}
◆ 系统类型：{system_type}
◆ 领域：{domain_vertical（来自第 1b 节）}
◆ 评估维度：{eval_concerns}
◆ 默认追踪工具：Arize Phoenix（或检测到的现有工具）
◆ 输出：{ai_spec_path}

下一步：
  /gsd-plan-phase {N}   — 规划者将使用 AI-SPEC.md
```

</process>

<success_criteria>
- [ ] 框架已选定并附有理由（第 2 节）
- [ ] 已从模板创建 AI-SPEC.md
- [ ] 已研究框架文档及 AI 最佳实践（第 3、4、4b 节已填写）
- [ ] 已研究领域上下文及专家评估标准要素（第 1b 节已填写）
- [ ] 评估策略基于领域上下文（第 5-7 节已填写）
- [ ] Arize Phoenix（或检测到的工具）已在第 7 节设为默认追踪工具
- [ ] AI-SPEC.md 已验证（第 1b、2、3、4b、5、6 节均非空）
- [ ] 已在启用 commit_docs 时提交
- [ ] 已向用户展示下一步
</success_criteria>
