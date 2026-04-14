<purpose>
通过多问题提示，交互式配置 GSD 工作流智能体（research、plan_check、verifier）和模型配置选择。更新 .planning/config.json 以反映用户偏好。可选地将设置保存为全局默认值 (~/.gsd/defaults.json)，以便用于未来的项目。
</purpose>

<required_reading>
在开始之前，阅读调用提示的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="ensure_and_load_config">
确保配置存在并加载当前状态：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-ensure-section
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

如果缺失，则创建带有默认值的 `.planning/config.json` 并加载当前配置值。
</step>

<step name="read_current">
```bash
cat .planning/config.json
```

解析当前值（如果不存在，默认设为 `true`）：
- `commit_docs` — 是否将规划文档自动提交至 Git（缺省为 true）
- `workflow.auto_commit` — 执行阶段完成任务后是否自动 git commit 代码（缺省为 true）
- `workflow.research` — 在 plan-phase 期间生成研究员 (researcher)
- `workflow.plan_check` — 在 plan-phase 期间生成计划检查员 (plan checker)
- `workflow.verifier` — 在 execute-phase 期间生成验证员 (verifier)
- `workflow.nyquist_validation` — 在 plan-phase 期间进行 Nyquist 验证架构研究（缺省为 true）
- `workflow.ui_phase` — 为前端阶段生成 UI-SPEC.md 设计契约（缺省为 true）
- `workflow.ui_safety_gate` — 在规划前端阶段前提示运行 /gsd:ui-phase（缺省为 true）
- `model_profile` — 每个智能体使用的模型（默认：`balanced`）
- `git.branching_strategy` — 分支策略（默认：`"none"`）
</step>

<step name="present_settings">
使用预选了当前值的 AskUserQuestion：

```
AskUserQuestion([
  {
    question: "智能体使用哪种模型配置 (Model Profile)？",
    header: "模型 (Model)",
    multiSelect: false,
    options: [
      { label: "Quality (高质量)", description: "除验证外全部使用 Opus（成本最高）" },
      { label: "Balanced (平衡 - 推荐)", description: "规划使用 Opus，研究/执行/验证使用 Sonnet" },
      { label: "Budget (经济)", description: "编写使用 Sonnet，研究/验证使用 Haiku（成本最低）" },
      { label: "Inherit (继承)", description: "所有智能体使用当前会话模型（最适合 OpenRouter、本地模型或运行时模型切换）" }
    ]
  },
  {
    question: "是否生成计划研究员 (Plan Researcher)？（在规划前研究领域知识）",
    header: "研究 (Research)",
    multiSelect: false,
    options: [
      { label: "是 (Yes)", description: "在规划前研究阶段目标" },
      { label: "否 (No)", description: "跳过研究，直接规划" }
    ]
  },
  {
    question: "是否生成计划检查员 (Plan Checker)？（在执行前验证计划）",
    header: "计划检查 (Plan Check)",
    multiSelect: false,
    options: [
      { label: "是 (Yes)", description: "验证计划是否符合阶段目标" },
      { label: "否 (No)", description: "跳过计划验证" }
    ]
  },
  {
    question: "是否生成执行验证员 (Execution Verifier)？（验证阶段完成情况）",
    header: "验证员 (Verifier)",
    multiSelect: false,
    options: [
      { label: "是 (Yes)", description: "在执行后验证必选项 (must-haves)" },
      { label: "否 (No)", description: "跳过执行后验证" }
    ]
  },
  {
    question: "是否自动推进管线？（自动进行 讨论 → 规划 → 执行）",
    header: "自动 (Auto)",
    multiSelect: false,
    options: [
      { label: "否 (No - 推荐)", description: "手动执行 /clear + 在各个阶段间粘贴" },
      { label: "是 (Yes)", description: "通过 Task() 子智能体链接各个阶段（保持相同的隔离性）" }
    ]
  },
  {
    question: "启用 Nyquist 验证？（在规划期间研究测试覆盖范围）",
    header: "Nyquist",
    multiSelect: false,
    options: [
      { label: "是 (Yes - 推荐)", description: "在 plan-phase 期间研究自动化测试覆盖。在计划中增加验证要求。如果任务缺少自动化验证，则阻止通过。" },
      { label: "否 (No)", description: "跳过验证研究。适合快速原型设计或无测试阶段。" }
    ]
  },
  // 注意：Nyquist 验证依赖于研究输出。如果禁用了研究，
  // plan-phase 将自动跳过 Nyquist 步骤（没有可供提取的 RESEARCH.md）。
  {
    question: "启用 UI 阶段 (UI Phase)？（为前端阶段生成 UI-SPEC.md 设计契约）",
    header: "UI 阶段",
    multiSelect: false,
    options: [
      { label: "是 (Yes - 推荐)", description: "在规划前端阶段前生成 UI 设计契约。锁定间距、排版、颜色和文案。" },
      { label: "否 (No)", description: "跳过 UI-SPEC 生成。适合仅后端项目或 API 阶段。" }
    ]
  },
  {
    question: "启用 UI 安全闸门 (UI Safety Gate)？（在规划前端阶段前提示运行 /gsd:ui-phase）",
    header: "UI 闸门 (UI Gate)",
    multiSelect: false,
    options: [
      { label: "是 (Yes - 推荐)", description: "当检测到前端特征时，plan-phase 会提示先运行 /gsd:ui-phase。" },
      { label: "否 (No)", description: "不提示 —— plan-phase 直接进行，不检查 UI-SPEC。" }
    ]
  },
  {
    question: "Git 分支策略？",
    header: "分支 (Branching)",
    multiSelect: false,
    options: [
      { label: "无 (None - 推荐)", description: "直接提交到当前分支" },
      { label: "按阶段 (Per Phase)", description: "为每个阶段创建分支 (gsd/phase-{N}-{name})" },
      { label: "按里程碑 (Per Milestone)", description: "为整个里程碑创建分支 (gsd/{version}-{name})" }
    ]
  },
  {
    question: "启用上下文窗口警告？（在上下文快满时注入建议消息）",
    header: "上下文警告 (Ctx Warnings)",
    multiSelect: false,
    options: [
      { label: "是 (Yes - 推荐)", description: "当上下文使用量超过 65% 时发出警告。有助于避免丢失工作。" },
      { label: "否 (No)", description: "禁用警告。允许 Claude 自然地达到自动压缩。适合长时间无人值守运行。" }
    ]
  },
  {
    question: "在提问前研究最佳实践？（在 new-project 和 discuss-phase 期间进行网页搜索）",
    header: "研究提问 (Research Qs)",
    multiSelect: false,
    options: [
      { label: "否 (No - 推荐)", description: "直接提问。更快，消耗更少 Token。" },
      { label: "是 (Yes)", description: "在每组问题前搜索网页以获取最佳实践。提问更具针对性，但消耗更多 Token。" }
    ]
  },
  {
    question: "是否将规划文档自动提交至 Git？",
    header: "Git 提交 (Commit Docs)",
    multiSelect: false,
    options: [
      { label: "是 (Yes - 推荐)", description: "工作流完成后自动提交 .planning/ 目录下的文档到 Git" },
      { label: "否 (No)", description: "不自动提交。规划文档仅保留在本地，不进入版本控制" }
    ]
  },
  {
    question: "执行阶段完成任务后是否自动 git commit 代码？",
    header: "自动提交代码 (Auto Commit)",
    multiSelect: false,
    options: [
      { label: "是 (Yes - 推荐)", description: "每个任务完成后自动执行 git add + git commit" },
      { label: "否 (No)", description: "跳过自动提交，仅输出变更摘要供手动提交" }
    ]
  }
])
```
</step>

<step name="update_config">
将新设置合并到现有的 config.json 中：

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget" | "inherit",
  "commit_docs": true/false,
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "auto_advance": true/false,
    "nyquist_validation": true/false,
    "ui_phase": true/false,
    "ui_safety_gate": true/false,
    "auto_commit": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone",
    "quick_branch_template": <string|null>
  },
  "hooks": {
    "context_warnings": true/false,
    "workflow_guard": true/false,
    "research_questions": true/false
  },
  "workflow": {
    "text_mode": true/false  // 使用纯文本提问而不是 TUI 菜单（用于 /rc 远程会话）
  }
}
```

当用户将 `commit_docs` 设为 `false` 时，自动将 `.planning/` 添加至 `.gitignore`（如果尚未存在）。
当用户将 `commit_docs` 从 `false` 改回 `true` 时，从 `.gitignore` 中移除 `.planning/` 条目（如果存在）。

将更新后的配置写入 `.planning/config.json`。
</step>

<step name="save_as_defaults">
询问是否将这些设置保存为未来项目的全局默认值：

```
AskUserQuestion([
  {
    question: "是否将这些设置为所有新项目的默认设置？",
    header: "默认值 (Defaults)",
    multiSelect: false,
    options: [
      { label: "是 (Yes)", description: "新项目将使用这些设置（保存到 ~/.gsd/defaults.json）" },
      { label: "否 (No)", description: "仅应用于此项目" }
    ]
  }
])
```

如果选择 "是 (Yes)"：将相同的配置对象（去掉项目特定字段，如 `brave_search`）写入 `~/.gsd/defaults.json`：

```bash
mkdir -p ~/.gsd
```

写入 `~/.gsd/defaults.json`：
```json
{
  "mode": <current>,
  "granularity": <current>,
  "model_profile": <current>,
  "commit_docs": <current>,
  "parallelization": <current>,
  "branching_strategy": <current>,
  "quick_branch_template": <current>,
  "workflow": {
    "research": <current>,
    "plan_check": <current>,
    "verifier": <current>,
    "auto_advance": <current>,
    "nyquist_validation": <current>,
    "ui_phase": <current>,
    "ui_safety_gate": <current>,
    "auto_commit": <current>
  }
}
```
</step>

<step name="confirm">
显示：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 设置已更新 (SETTINGS UPDATED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| 设置 (Setting)       | 值 (Value) |
|----------------------|-----------|
| 模型配置 (Model Profile) | {quality/balanced/budget/inherit} |
| 计划研究员 (Plan Researcher) | {开启/关闭} |
| 计划检查员 (Plan Checker) | {开启/关闭} |
| 执行验证员 (Execution Verifier) | {开启/关闭} |
| 自动推进 (Auto-Advance) | {开启/关闭} |
| Nyquist 验证 (Nyquist Validation) | {开启/关闭} |
| UI 阶段 (UI Phase) | {开启/关闭} |
| UI 安全闸门 (UI Safety Gate) | {开启/关闭} |
| Git 提交文档 (Commit Docs) | {开启/关闭} |
| 自动提交代码 (Auto Commit) | {开启/关闭} |
| Git 分支 (Git Branching) | {无/按阶段/按里程碑} |
| 上下文警告 (Context Warnings) | {开启/关闭} |
| 已保存为默认值 (Saved as Defaults) | {是/否} |

这些设置将应用于未来的 /gsd:plan-phase 和 /gsd:execute-phase 运行。

快速命令：
- /gsd:set-profile <profile> — 切换模型配置
- /gsd:plan-phase --research — 强制进行研究
- /gsd:plan-phase --skip-research — 跳过研究
- /gsd:plan-phase --skip-verify — 跳过计划检查
```
</step>

</process>

<success_criteria>
- [ ] 已读取当前配置
- [ ] 向用户呈现了 11 个设置（配置 + 7 个工作流开关 + Git 提交 + 自动提交代码 + Git 分支）
- [ ] 配置已更新，包含 model_profile、commit_docs、workflow 和 git 部分
- [ ] 已提议用户保存为全局默认值 (~/.gsd/defaults.json)
- [ ] 已向用户确认更改
</success_criteria>
