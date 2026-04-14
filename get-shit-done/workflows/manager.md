<purpose>

单终端里程碑管理的交互式指挥中心。显示所有阶段的可视化状态仪表板，将讨论步骤以内联方式执行，将计划/执行步骤作为后台 agent 调度，每次操作后返回仪表板。支持从单个终端并行推进多个阶段。

</purpose>

<required_reading>

开始前，读取调用提示的 execution_context 中引用的所有文件。

</required_reading>

<process>

<step name="initialize" priority="first">

## 1. 初始化

通过 manager init 引导：

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init manager)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON 字段：`milestone_version`、`milestone_name`、`phase_count`、`completed_count`、`in_progress_count`、`phases`、`recommended_actions`、`all_complete`、`waiting_signal`、`manager_flags`。

`manager_flags` 包含来自配置的各步骤透传参数：
- `manager_flags.discuss` — 追加到 `/gsd-discuss-phase` 参数（如 `"--auto --analyze"`）
- `manager_flags.plan` — 追加到 plan agent init 命令
- `manager_flags.execute` — 追加到 execute agent init 命令

默认为空字符串。通过以下命令设置：`gsd-tools config-set manager.flags.discuss "--auto --analyze"`

**若出错：** 显示错误信息并退出。

显示启动横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 管理器
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 {milestone_version} — {milestone_name}
 {phase_count} 个阶段 · {completed_count} 个已完成

 ✓ 讨论 → 内联    ◆ 计划/执行 → 后台
 后台工作进行中时仪表板自动刷新。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

继续执行仪表板步骤。

</step>

<step name="dashboard">

## 2. 仪表板（刷新点）

**每次到达此步骤时**，从磁盘重新读取状态以获取后台 agent 的最新变更：

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init manager)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析完整 JSON，构建仪表板显示。

从 JSON 构建仪表板。符号：`✓` 已完成，`◆` 进行中，`○` 待执行，`·` 待排队。进度条：20 字符 `█░`。

**状态映射**（disk_status → D P E 状态）：

- `complete` → `✓ ✓ ✓` `✓ 已完成`
- `partial` → `✓ ✓ ◆` `◆ 执行中...`
- `planned` → `✓ ✓ ○` `○ 待执行`
- `discussed` → `✓ ○ ·` `○ 待计划`
- `researched` → `◆ · ·` `○ 待计划`
- `empty`/`no_directory` + `is_next_to_discuss` → `○ · ·` `○ 待讨论`
- `empty`/`no_directory` 其他情况 → `· · ·` `· 待开始`
- 若 `is_active`，将状态图标替换为 `◆` 并追加 `(进行中)`

若有任何 `is_active` 阶段，在表格上方显示：`◆ 后台：{action} 第 {N} 阶段, ...`

使用 `display_name`（非 `name`）作为阶段列 — 它已预先截断为 20 个字符，超出部分用 `…` 标记。将所有阶段名称填充到相同宽度以对齐。

使用 init JSON 中的 `deps_display` 作为依赖列 — 显示该阶段依赖的阶段（如 `1,3`）或无依赖时显示 `—`。

示例输出：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 仪表板
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ████████████░░░░░░░░ 60%  (3/5 阶段)
 ◆ 后台：计划第 4 阶段
 | # | 阶段                 | 依赖 | D | P | E | 状态                |
 |---|----------------------|------|---|---|---|---------------------|
 | 1 | Foundation           | —    | ✓ | ✓ | ✓ | ✓ 已完成            |
 | 2 | API Layer            | 1    | ✓ | ✓ | ◆ | ◆ 执行中（进行中）  |
 | 3 | Auth System          | 1    | ✓ | ✓ | ○ | ○ 待执行            |
 | 4 | Dashboard UI & Set…  | 1,2  | ✓ | ◆ | · | ◆ 计划中（进行中）  |
 | 5 | Notifications        | —    | ○ | · | · | ○ 待讨论            |
 | 6 | Polish & Final Mail… | 1-5  | · | · | · | · 待开始            |
```

**建议章节：**

若 `all_complete` 为 true：

```
╔══════════════════════════════════════════════════════════════╗
║  里程碑已完成                                                ║
╚══════════════════════════════════════════════════════════════╝

所有 {phase_count} 个阶段已完成。准备进行最终步骤：
  → /gsd-verify-work — 运行验收测试
  → /gsd-complete-milestone — 归档并收尾
```


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 参数）：** 若 `$ARGUMENTS` 中包含 `--text` 或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。TEXT_MODE 激活时，将所有 `AskUserQuestion` 调用替换为纯文本编号列表，要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需设置，因为这些运行时不支持 `AskUserQuestion`。
通过 AskUserQuestion 询问用户：
- **question:** "所有阶段已完成。下一步？"
- **options:** "验证工作" / "完成里程碑" / "退出管理器"

处理响应：
- "验证工作"：`Skill(skill="gsd-verify-work")` 然后循环到仪表板。
- "完成里程碑"：`Skill(skill="gsd-complete-milestone")` 然后退出。
- "退出管理器"：跳转到退出步骤。

**若 NOT all_complete**，从 `recommended_actions` 构建复合选项：

**复合选项逻辑：** 将后台操作（计划/执行）分组，并在有内联操作（讨论）时将其配对。目标是呈现尽可能少的选项 — 一个选项可以调度多个后台 agent 加上一个内联操作。

**构建选项：**

1. 收集所有后台操作（执行和计划建议）— 可能有多个。
2. 收集内联操作（讨论建议，若有 — 最多一个，因为讨论是顺序执行的）。
3. 构建复合选项：

   **若有任何推荐操作（后台、内联或两者均有）：**
   创建一个包含所有操作的主要"继续"选项：
   - 标签：`"继续"` — 始终使用此确切词语
   - 在标签下方列出所有将要执行的操作。列举所有推荐操作 — 不截断：
     ```
     继续：
       → 执行第 32 阶段（后台）
       → 计划第 34 阶段（后台）
       → 讨论第 35 阶段（内联）
     ```
   - 先调度所有后台 agent，然后运行内联讨论（若有）。
   - 若无内联讨论，生成后台 agent 后刷新仪表板。

   **重要：** 继续选项必须包含 `recommended_actions` 中的每个操作 — 不截断。若有 3 个操作，列出 3 个；若有 5 个，列出 5 个。

4. 始终添加：
   - `"刷新仪表板"`
   - `"退出管理器"`

紧凑显示建议：

```
───────────────────────────────────────────────────────────────
▶ 后续步骤
───────────────────────────────────────────────────────────────

继续：
  → 执行第 32 阶段（后台）
  → 计划第 34 阶段（后台）
  → 讨论第 35 阶段（内联）
```

**自动刷新：** 若后台 agent 正在运行（任意阶段的 `is_active` 为 true），设置 60 秒自动刷新周期。显示操作菜单后，若 60 秒内未收到用户输入，自动刷新仪表板。此间隔可通过 GSD 配置中的 `manager_refresh_interval` 设置（默认 60 秒，设置为 0 禁用）。

通过 AskUserQuestion 呈现：
- **question:** "您想做什么？"
- **options:** （如上构建的复合选项 + 刷新 + 退出，AskUserQuestion 自动添加"其他"）

**选择"其他"（自由文本）时：** 解析意图 — 若提及阶段编号和操作，则相应调度。若不明确，显示可用操作并循环到 action_menu。

继续执行 handle_action 步骤，处理所选操作。

</step>

<step name="handle_action">

## 4. 处理操作

### 刷新仪表板

循环回仪表板步骤。

### 退出管理器

跳转到退出步骤。

### 复合操作（后台 + 内联）

用户选择复合选项时：

1. **先生成所有后台 agent**（计划/执行）— 使用下方的计划/执行阶段 N 处理程序并行调度。
2. **然后运行内联讨论：**

```
Skill(skill="gsd-discuss-phase", args="{PHASE_NUM} {manager_flags.discuss}")
```

讨论完成后，循环回仪表板步骤（后台 agent 继续运行）。

### 讨论第 N 阶段

讨论是交互式的 — 需要用户输入。使用配置的参数内联运行：

```
Skill(skill="gsd-discuss-phase", args="{PHASE_NUM} {manager_flags.discuss}")
```

讨论完成后，循环回仪表板步骤。

### 计划第 N 阶段

计划自主运行。生成一个后台 agent，使用配置的参数委托给 Skill 流水线：

```
Task(
  description="计划第 {N} 阶段：{phase_name}",
  run_in_background=true,
  prompt="您正在为项目第 {N} 阶段运行 GSD plan-phase 工作流。

工作目录：{cwd}
阶段：{N} — {phase_name}
目标：{goal}
管理器参数：{manager_flags.plan}

使用配置的管理器参数运行 plan-phase Skill：
Skill(skill=\"gsd-plan-phase\", args=\"{N} --auto {manager_flags.plan}\")

这将委托给完整的 plan-phase 流水线，包括本地补丁、研究、计划检查器和所有质量门禁。

重要：您在后台运行。不要使用 AskUserQuestion — 根据项目上下文自主决策。若遇到阻塞，将其写入 STATE.md 的 blocker 字段并停止。不要静默绕过权限或文件访问错误 — 让其失败，以便管理器能显示并提供解决提示。不要在 git 提交中使用 --no-verify。"
)
```

显示：

```
◆ 正在为第 {N} 阶段生成计划 agent：{phase_name}...
```

循环回仪表板步骤。

### 执行第 N 阶段

执行自主运行。生成一个后台 agent，使用配置的参数委托给 Skill 流水线：

```
Task(
  description="执行第 {N} 阶段：{phase_name}",
  run_in_background=true,
  prompt="您正在为项目第 {N} 阶段运行 GSD execute-phase 工作流。

工作目录：{cwd}
阶段：{N} — {phase_name}
目标：{goal}
管理器参数：{manager_flags.execute}

使用配置的管理器参数运行 execute-phase Skill：
Skill(skill=\"gsd-execute-phase\", args=\"{N} {manager_flags.execute}\")

这将委托给完整的 execute-phase 流水线，包括本地补丁、分支、波次执行、验证和所有质量门禁。

重要：您在后台运行。请自主决策。不要在 git 提交中使用 --no-verify — 让 pre-commit 钩子正常运行。若遇到权限错误、文件锁或任何访问问题，不要绕过 — 让其失败并将错误写入 STATE.md 的 blocker 字段，以便管理器能显示并提供解决指导。"
)
```

显示：

```
◆ 正在为第 {N} 阶段生成执行 agent：{phase_name}...
```

循环回仪表板步骤。

</step>

<step name="background_completion">

## 5. 后台 Agent 完成

收到后台 agent 完成通知时：

1. 读取 agent 的结果消息。
2. 显示简短通知：

```
✓ {description}
  {来自 agent 结果的简短摘要}
```

3. 循环回仪表板步骤。

**若 agent 报告错误或阻塞：**

对错误进行分类：

**权限/工具访问错误**（如工具不允许、权限被拒、沙箱限制）：
- 解析错误以识别被阻止的工具或命令。
- 清晰显示错误，然后提供修复选项：
  - **question:** "第 {N} 阶段失败 — `{tool_or_command}` 权限被拒。是否将其添加到 settings.local.json 以允许访问？"
  - **options:** "添加权限并重试" / "改为内联运行此阶段" / "跳过并继续"
  - "添加权限并重试"：使用 `Skill(skill="update-config")` 将权限添加到 `settings.local.json`，然后重新生成后台 agent。循环到仪表板。
  - "改为内联运行此阶段"：通过适当的 Skill 内联调度相同操作 — 若失败的操作是计划，使用 `Skill(skill="gsd-plan-phase", args="{N}")`；若是执行，使用 `Skill(skill="gsd-execute-phase", args="{N}")`。操作完成后循环到仪表板。
  - "跳过并继续"：循环到仪表板（阶段保持当前状态）。

**其他错误**（git 锁、文件冲突、逻辑错误等）：
- 显示错误，然后通过 AskUserQuestion 提供选项：
  - **question:** "第 {N} 阶段的后台 agent 遇到问题：{error}。下一步？"
  - **options:** "重试" / "改为内联运行" / "跳过并继续" / "查看详情"
  - "重试"：重新生成相同的后台 agent。循环到仪表板。
  - "改为内联运行"：通过适当的 Skill 内联调度操作 — 若失败的操作是计划，使用 `Skill(skill="gsd-plan-phase", args="{N}")`；若是执行，使用 `Skill(skill="gsd-execute-phase", args="{N}")`。操作完成后循环到仪表板。
  - "跳过并继续"：循环到仪表板（阶段保持当前状态）。
  - "查看详情"：读取 STATE.md 阻塞章节，显示内容，然后重新呈现选项。

</step>

<step name="exit">

## 6. 退出

显示最终状态及进度条：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 会话结束
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 {milestone_version} — {milestone_name}
 {PROGRESS_BAR} {progress_pct}%  ({completed_count}/{phase_count} 阶段)

 随时恢复：/gsd-manager
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**注意：** 仍在运行的后台 agent 将继续执行至完成。其结果将在下次调用 `/gsd-manager` 或 `/gsd-progress` 时可见。

</step>

</process>

<success_criteria>
- [ ] 仪表板显示所有阶段及正确的状态指示（D/P/E/V 列）
- [ ] 进度条显示准确的完成百分比
- [ ] 依赖解析：被阻塞的阶段显示缺失的依赖
- [ ] 建议优先级：执行 > 计划 > 讨论
- [ ] 讨论阶段通过 Skill() 内联运行 — 交互式问题正常工作
- [ ] 计划阶段生成后台 Task agent — 立即返回仪表板
- [ ] 执行阶段生成后台 Task agent — 立即返回仪表板
- [ ] 仪表板刷新通过磁盘状态获取后台 agent 的变更
- [ ] 后台 agent 完成触发通知和仪表板刷新
- [ ] 后台 agent 错误呈现重试/跳过选项
- [ ] 全部完成状态提供验证工作和完成里程碑选项
- [ ] 退出时显示最终状态及恢复说明
- [ ] "其他"自由文本输入能解析阶段编号和操作
- [ ] 管理器循环持续至用户退出或里程碑完成
</success_criteria>
