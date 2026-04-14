<purpose>
使用代码库优先分析和假设浮现方法，提取下游 Agent 所需的实现决策，而非采用访谈式提问。

你是思维伙伴，而非提问者。深入分析代码库，根据证据提出你的判断，并仅就错误之处请用户纠正。
</purpose>

<available_agent_types>
有效的 GSD 子 Agent 类型（请使用确切名称——不要退化为 'general-purpose'）：
- gsd-assumptions-analyzer — 分析代码库以浮现实现假设
</available_agent_types>

<downstream_awareness>
**CONTEXT.md 将用于：**

1. **gsd-phase-researcher** — 读取 CONTEXT.md 以了解要研究的内容
2. **gsd-planner** — 读取 CONTEXT.md 以了解已锁定的决策

**你的职责：** 将决策清晰记录，使下游 Agent 无需再次向用户询问即可执行。输出格式与讨论模式相同——相同的 CONTEXT.md 格式。
</downstream_awareness>

<philosophy>
**假设模式哲学：**

用户是有远见的人，而非代码库考古学家。他们需要足够的上下文来评估你的假设是否符合其意图——而不是回答你本可以通过阅读代码自行找到答案的问题。

- 先读代码库，再形成观点，仅就真正不明确的内容提问
- 每个假设必须引用证据（文件路径、发现的模式）
- 每个假设必须说明如果错误的后果
- 最小化用户交互：约 2-4 次纠正，而非 15-20 个问题
</philosophy>

<scope_guardrail>
**关键：禁止范围蔓延。**

阶段边界来自 ROADMAP.md，是固定的。讨论旨在澄清如何实现已规划的内容，而非是否添加新功能。

当用户建议范围蔓延时：
"[功能 X] 将是一项新能力——那是另一个独立的阶段。
要我将其记录在路线图待办列表中吗？现在，让我们专注于 [阶段领域]。"

将该想法记入"延期想法"。不要丢失它，也不要付诸行动。
</scope_guardrail>

<answer_validation>
**重要：答案验证** — 每次 AskUserQuestion 调用后，检查响应是否为空或仅包含空白。如果是：
1. 以相同参数重试一次问题
2. 如果仍为空，以纯文本编号列表呈现选项

**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 标志）：**
当文本模式激活时，完全不使用 AskUserQuestion。将每个问题以纯文本编号列表形式呈现，并请用户键入其选择编号。
</answer_validation>

<process>

<step name="initialize" priority="first">
从参数中获取阶段编号（必填）。

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ANALYZER=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-assumptions-analyzer 2>/dev/null)
```

解析 JSON，获取：`commit_docs`、`phase_found`、`phase_dir`、`phase_number`、`phase_name`、
`phase_slug`、`padded_phase`、`has_research`、`has_context`、`has_plans`、`has_verification`、
`plan_count`、`roadmap_exists`、`planning_exists`。

**如果 `phase_found` 为 false：**
```
在路线图中未找到阶段 [X]。

使用 /gsd-progress 查看可用阶段。
```
退出工作流。

**如果 `phase_found` 为 true：** 继续执行 check_existing。

**自动模式** — 如果 ARGUMENTS 中存在 `--auto`：
- 在 `check_existing` 中：自动选择"更新"（如果上下文已存在），或无需提示直接继续
- 在 `present_assumptions` 中：跳过确认关卡，直接写入 CONTEXT.md
- 在 `correct_assumptions` 中：为每项纠正自动选择推荐选项
- 逐行记录每次自动选择
- 完成后，自动推进到 plan-phase
</step>

<step name="check_existing">
使用 init 中的 `has_context` 检查 CONTEXT.md 是否已存在。

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**如果存在：**

**如果 `--auto`：** 自动选择"更新"。记录：`[auto] 上下文已存在——使用基于假设的分析更新。`

**否则：** 使用 AskUserQuestion：
- header: "上下文"
- question: "阶段 [X] 已有上下文。您想怎么做？"
- options:
  - "更新" — 重新分析代码库并刷新假设
  - "查看" — 显示现有内容
  - "跳过" — 按原样使用现有上下文

如果"更新"：加载现有内容，继续到 load_prior_context
如果"查看"：显示 CONTEXT.md，然后提供更新/跳过选项
如果"跳过"：退出工作流

**如果不存在：**

检查 init 中的 `has_plans` 和 `plan_count`。**如果 `has_plans` 为 true：**

**如果 `--auto`：** 自动选择"继续并在之后重新规划"。记录：`[auto] 计划已存在——继续假设分析，之后将重新规划。`

**否则：** 使用 AskUserQuestion：
- header: "计划已存在"
- question: "阶段 [X] 已有 {plan_count} 个在没有用户上下文的情况下创建的计划。除非您重新规划，否则此处的决策不会影响现有计划。"
- options:
  - "继续并在之后重新规划"
  - "查看现有计划"
  - "取消"

如果"继续并在之后重新规划"：继续到 load_prior_context。
如果"查看现有计划"：显示计划文件，然后提供"继续" / "取消"选项。
如果"取消"：退出工作流。

**如果 `has_plans` 为 false：** 继续到 load_prior_context。
</step>

<step name="load_prior_context">
读取项目级和先前阶段的上下文，避免重复询问已决定的问题。

**步骤 1：读取项目级文件**
```bash
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

从这些文件中提取：
- **PROJECT.md** — 愿景、原则、不可协商事项、用户偏好
- **REQUIREMENTS.md** — 验收标准、约束条件
- **STATE.md** — 当前进度、任何标志

**步骤 2：读取所有先前的 CONTEXT.md 文件**
```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

对于每个阶段编号小于当前阶段的 CONTEXT.md：
- 读取 `<decisions>` 部分——这些是已锁定的偏好
- 读取 `<specifics>` ——特定引用或"我希望像 X 那样"的时刻
- 注意模式（例如"用户始终偏好最简 UI"）

**步骤 3：构建内部 `<prior_decisions>` 上下文**

将提取的信息结构化，用于假设生成。

**如果不存在先前上下文：** 无需先前上下文继续——对于早期阶段是正常的。
</step>

<step name="cross_reference_todos">
检查是否有待处理的待办事项与本阶段范围相关。

```bash
TODO_MATCHES=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" todo match-phase "${PHASE_NUMBER}")
```

解析 JSON，获取：`todo_count`、`matches[]`。

**如果 `todo_count` 为 0：** 静默跳过。

**如果找到匹配项：** 呈现匹配的待办事项，使用 AskUserQuestion（multiSelect）将相关项折叠到范围中。

**对于已选择（折叠的）待办事项：** 存储为 CONTEXT.md `<decisions>` 部分的 `<folded_todos>`。
**对于未选择的：** 存储为 CONTEXT.md `<deferred>` 部分的 `<reviewed_todos>`。

**自动模式（`--auto`）：** 自动折叠所有分数 >= 0.4 的待办事项。记录该选择。
</step>

<step name="load_methodology">
如果存在项目级方法论文件，则在假设分析之前读取。这必须在假设生成和评估之前发生，以便激活的视角能够塑造假设的方式。

```bash
cat .planning/METHODOLOGY.md 2>/dev/null || true
```

**如果 METHODOLOGY.md 存在：**
- 解析每个命名视角：其诊断、建议和触发条件
- 存储为内部 `<active_lenses>`，用于 deep_codebase_analysis 和 present_assumptions
- 生成 gsd-assumptions-analyzer 时，传递视角列表，以便其标记适用的视角
- 呈现假设时，附加"方法论"部分，显示应用了哪些视角及其标记内容（如有）

**如果 METHODOLOGY.md 不存在：** 静默跳过。此制品是可选的。
</step>

<step name="scout_codebase">
对现有代码进行轻量级扫描，为假设生成提供依据。

**步骤 1：检查现有代码库地图**
```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**如果代码库地图存在：** 读取相关地图（CONVENTIONS.md、STRUCTURE.md、STACK.md）。提取可复用组件、模式、集成点。跳到步骤 3。

**步骤 2：如果没有代码库地图，执行有针对性的 grep**

从阶段目标中提取关键词，搜索相关文件。

```bash
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

读取 3-5 个最相关的文件。

**步骤 3：构建内部 `<codebase_context>`**

识别可复用资产、已建立的模式、集成点和创意选项。在内部存储，用于 deep_codebase_analysis。
</step>

<step name="deep_codebase_analysis">
生成 `gsd-assumptions-analyzer` Agent，深入分析本阶段的代码库。这
将原始文件内容排除在主上下文窗口之外，保护 token 预算。

**解析校准层级（如果 USER-PROFILE.md 存在）：**

```bash
PROFILE_PATH="$HOME/.claude/get-shit-done/USER-PROFILE.md"
```

如果文件存在于 PROFILE_PATH：
- 优先级 1：读取 config.json > preferences.vendor_philosophy（项目级覆盖）
- 优先级 2：读取 USER-PROFILE.md 供应商选择/哲学评分（全局）
- 优先级 3：默认为 "standard"

映射到校准层级：
- conservative 或 thorough-evaluator → full_maturity（更多替代方案，详细证据）
- opinionated → minimal_decisive（更少替代方案，果断推荐）
- pragmatic-fast 或任何其他值 → standard

如果没有 USER-PROFILE.md：calibration_tier = "standard"

**生成探索子 Agent：**

```
Task(subagent_type="gsd-assumptions-analyzer", prompt="""
分析阶段 {PHASE}：{phase_name} 的代码库。

阶段目标：{roadmap_description}
先前决策：{prior_decisions_summary}
代码库侦察提示：{codebase_context_summary}
校准：{calibration_tier}

你的职责：
1. 读取 ROADMAP.md 阶段 {PHASE} 描述
2. 读取先前阶段的所有 CONTEXT.md 文件
3. Glob/Grep 与以下内容相关的文件：{phase_relevant_terms}
4. 读取 5-15 个最相关的源文件
5. 返回结构化假设

## 输出格式

返回确切以下结构：

## 假设

### [领域名称]（例如"技术方案"）
- **假设：** [决策陈述]
  - **这样做的原因：** [代码库中的证据——引用文件路径]
  - **如果错误：** [该假设错误的具体后果]
  - **置信度：** 确信 | 可能 | 不明确

（3-5 个领域，按层级校准：
- full_maturity：3-5 个领域，每个可能/不明确项有 2-3 个替代方案
- standard：3-4 个领域，每个可能/不明确项有 2 个替代方案
- minimal_decisive：2-3 个领域，每项给出果断的单一推荐）

## 需要外部研究
[仅凭代码库无法充分解答的主题——库版本兼容性、
生态系统最佳实践等。如果代码库提供了足够证据则留空。]

${AGENT_SKILLS_ANALYZER}
""")
```

解析子 Agent 的响应。提取：
- `assumptions[]` — 每项包含领域、陈述、证据、后果、置信度
- `needs_research[]` — 需要外部研究的主题（可能为空）

**初始化规范引用累积器：**
- 来源 1：从 ROADMAP.md 复制本阶段的 `Canonical refs:`，扩展为完整路径
- 来源 2：检查 REQUIREMENTS.md 和 PROJECT.md 中引用的规范/ADR
- 来源 3：添加代码库侦察结果中引用的任何文档
</step>

<step name="external_research">
**跳过条件：** 如果 deep_codebase_analysis 中的 `needs_research` 为空。

如果标记了研究主题，生成一个通用研究 Agent：

```
Task(subagent_type="general-purpose", prompt="""
研究阶段 {PHASE}：{phase_name} 的以下主题。

需要研究的主题：
{needs_research_content}

对于每个主题，返回：
- **发现：** [你了解到的内容]
- **来源：** [URL 或库文档参考]
- **置信度影响：** [这解决了哪个假设，达到什么置信度]

对于库相关问题，使用 Context7（resolve-library-id 然后 query-docs）。
对于生态系统/最佳实践问题，使用 WebSearch。
""")
```

将发现合并回假设：
- 在研究解决歧义的地方更新置信度
- 向受影响的假设添加来源归因
- 存储研究发现用于 DISCUSSION-LOG.md

**如果没有标记差距：** 完全跳过。大多数阶段将跳过此步骤。
</step>

<step name="present_assumptions">
按领域分组显示所有假设，并附置信度标识。

**显示格式：**

```
## 阶段 {PHASE}：{phase_name} — 假设

基于代码库分析，以下是我的方案：

### {领域名称}
{置信度标识} **{假设陈述}**
↳ 证据：{引用的文件路径}
↳ 如果错误：{后果}

### {领域名称 2}
...

[如果进行了外部研究：]
### 已应用的外部研究
- {主题}：{发现}（来源：{URL}）
```

**如果 `--auto`：**
- 如果所有假设都是确信或可能：记录假设，跳到 write_context。
  记录：`[auto] 所有假设为确信/可能——继续上下文捕获。`
- 如果有任何不明确假设：记录警告，为每个不明确项自动选择推荐替代方案。
  记录：`[auto] {N} 个不明确假设已使用推荐默认值自动解决。`
  继续到 write_context。

**否则：** 使用 AskUserQuestion：
- header: "假设"
- question: "这些都看起来正确吗？"
- options:
  - "是的，继续" — 使用这些假设作为决策写入 CONTEXT.md
  - "让我纠正一些" — 选择要更改的假设

**如果"是的，继续"：** 跳到 write_context。
**如果"让我纠正一些"：** 继续到 correct_assumptions。
</step>

<step name="correct_assumptions">
假设已在上面的 present_assumptions 中显示。

呈现一个 multiSelect，每个选项的标签是假设陈述，描述是"如果错误"的后果：

使用 AskUserQuestion（multiSelect）：
- header: "纠正"
- question: "哪些假设需要纠正？"
- options: [每个假设一项，标签 = 假设陈述，描述 = "如果错误：{后果}"]

对于每个选定的纠正，提出一个有针对性的问题：

使用 AskUserQuestion：
- header: "{领域名称}"
- question: "对于：{假设陈述}，我们应该怎么做？"
- options: [2-3 个描述用户可见结果的具体替代方案，推荐选项优先]

记录每项纠正：
- 原始假设
- 用户选择的替代方案
- 原因（如果通过"其他"自由文本提供）

处理完所有纠正后，使用更新的假设继续到 write_context。

**自动模式：** 不应到达此步骤（--auto 从 present_assumptions 跳过）。
</step>

<step name="write_context">
如果需要，创建阶段目录。使用标准 6 部分格式写入 CONTEXT.md。

**文件：** `${phase_dir}/${padded_phase}-CONTEXT.md`

将假设映射到 CONTEXT.md 各部分：
- 假设 → `<decisions>`（每个假设成为一个锁定决策：D-01、D-02 等）
- 纠正 → 在 `<decisions>` 中覆盖原始假设
- 所有假设都为确信的领域 → 标记为锁定决策
- 有纠正的领域 → 将用户选择的替代方案作为决策

```markdown
# 阶段 {PHASE}：{phase_name} - 上下文

**收集时间：** {date}（假设模式）
**状态：** 准备规划

<domain>
## 阶段边界

{来自 ROADMAP.md 的领域边界——范围锚点的清晰陈述}
</domain>

<decisions>
## 实现决策

### {领域名称 1}
- **D-01：** {决策——来自假设或纠正}
- **D-02：** {决策}

### {领域名称 2}
- **D-03：** {决策}

### Claude 的自由裁量
{用户确认"你来决定"或以"可能"置信度保留的假设}

### 折叠的待办事项
{如果有待办事项被折叠到范围中}
</decisions>

<canonical_refs>
## 规范引用

**下游 Agent 在规划或实现前必须阅读这些内容。**

{来自分析步骤的规范引用累积——完整相对路径}

[如果没有外部规范："无外部规范——需求已在上述决策中完整捕获"]
</canonical_refs>

<code_context>
## 现有代码洞察

### 可复用资产
{来自代码库侦察 + 探索子 Agent 发现}

### 已建立的模式
{约束/使能本阶段的模式}

### 集成点
{新代码连接到现有系统的位置}
</code_context>

<specifics>
## 具体想法

{来自纠正或用户输入的特定引用}

[如果没有："无特定要求——接受标准方法"]
</specifics>

<deferred>
## 延期想法

{纠正过程中提到的超出范围的想法}

### 已审查的待办事项（未折叠）
{已审查但未折叠的待办事项——及原因}

[如果没有："无——分析保持在阶段范围内"]
</deferred>
```

写入文件。
</step>

<step name="write_discussion_log">
写入假设和纠正的审计跟踪。

**文件：** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# 阶段 {PHASE}：{phase_name} - 讨论日志（假设模式）

> **仅供审计跟踪。** 不要作为规划、研究或执行 Agent 的输入。
> 决策已在 CONTEXT.md 中捕获——此日志保留分析过程。

**日期：** {ISO date}
**阶段：** {padded_phase}-{phase_name}
**模式：** assumptions
**已分析领域：** {逗号分隔的领域名称}

## 呈现的假设

### {领域名称}
| 假设 | 置信度 | 证据 |
|------|--------|------|
| {陈述} | {确信/可能/不明确} | {文件路径} |

{对每个领域重复}

## 已做的纠正

{如果进行了纠正：}

### {领域名称}
- **原始假设：** {Claude 假设的内容}
- **用户纠正：** {用户选择的替代方案}
- **原因：** {用户的理由，如果提供}

{如果没有纠正："无纠正——所有假设已确认。"}

## 自动解决

{如果 --auto 且存在不明确项：}
- {假设}：自动选择了 {推荐选项}

{如果不适用：省略此部分}

## 外部研究

{如果进行了研究：}
- {主题}：{发现}（来源：{URL}）

{如果没有研究：省略此部分}
```

写入文件。
</step>

<step name="git_commit">
提交阶段上下文和讨论日志：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): capture phase context (assumptions mode)" --files "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
```

确认："已提交：docs(${padded_phase}): capture phase context (assumptions mode)"
</step>

<step name="update_state">
使用会话信息更新 STATE.md：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} context gathered (assumptions mode)" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

提交 STATE.md：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>

<step name="confirm_creation">
呈现摘要和后续步骤：

```
已创建：.planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## 已捕获的决策（假设模式）

### {领域名称}
- {关键决策}（来自假设 / 已纠正）

{每个领域重复}

[如果进行了纠正：]
## 已应用的纠正
- {领域}：{原始} → {已纠正}

[如果存在延期想法：]
## 稍后注意
- {延期想法} — 未来阶段

---

## ▶ 下一步

**阶段 ${PHASE}：{phase_name}** — {来自 ROADMAP.md 的目标}

`/clear` 然后：

`/gsd-plan-phase ${PHASE}`

---

**同样可用：**
- `/gsd-plan-phase ${PHASE} --skip-research` — 无需研究直接规划
- `/gsd-ui-phase ${PHASE}` — 生成 UI 设计契约（如果是前端工作）
- 在继续之前查看/编辑 CONTEXT.md

---
```
</step>

<step name="auto_advance">
检查自动推进触发器：

1. 从 $ARGUMENTS 解析 `--auto` 标志
2. 同步链标志：
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. 读取链标志和用户偏好：
   ```bash
   AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**如果存在 `--auto` 标志且 `AUTO_CHAIN` 不为 true：**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active true
```

**如果存在 `--auto` 标志 或 `AUTO_CHAIN` 为 true 或 `AUTO_CFG` 为 true：**

显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 自动推进到规划阶段
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

已捕获上下文（假设模式）。正在启动 plan-phase...
```

启动：`Skill(skill="gsd-plan-phase", args="${PHASE} --auto")`

处理返回：PHASE COMPLETE / PLANNING COMPLETE / INCONCLUSIVE / GAPS FOUND
（与 discuss-phase.md auto_advance 步骤中的处理方式相同）

**如果 `--auto` 和配置均未启用：**
路由到 confirm_creation 步骤。
</step>

</process>

<success_criteria>
- 阶段已针对路线图验证
- 已加载先前上下文（不重复询问已决定的问题）
- 通过探索子 Agent 深度分析代码库（已读取 5-15 个文件）
- 浮现假设，附证据和置信度
- 用户确认或纠正假设（最多约 2-4 次交互）
- 范围蔓延重定向到延期想法
- CONTEXT.md 捕获实际决策（与讨论模式相同的格式）
- CONTEXT.md 包含带完整文件路径的 canonical_refs（必须）
- CONTEXT.md 包含来自代码库分析的 code_context
- DISCUSSION-LOG.md 记录假设和纠正作为审计跟踪
- STATE.md 已更新会话信息
- 用户了解后续步骤
</success_criteria>
