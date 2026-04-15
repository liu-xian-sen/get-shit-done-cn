<purpose>
使用基于波次（wave-based）的并行执行来执行阶段中的所有计划。编排器保持精简 —— 将计划执行委托给子代理。
</purpose>

<core_principle>
编排器负责协调，不负责执行。每个子代理加载完整的 execute-plan 上下文。编排器：发现计划 → 分析依赖 → 分组波次 → 生成代理 → 处理检查点 → 收集结果。
</core_principle>

<runtime_compatibility>
**子代理生成是特定于运行时的：**
- **Claude Code：** 使用 `Task(subagent_type="gsd-executor", ...)` —— 阻塞直到完成，返回结果
- **Copilot：** 子代理生成无法可靠地返回完成信号。**默认为顺序内联执行**：针对每个计划直接阅读并遵循 execute-plan.md，而不是生成并行代理。仅当用户明确要求时才尝试并行生成 —— 在这种情况下，依靠步骤 3 中的抽查回退机制来检测完成。
- **其他运行时 (Gemini, Codex, OpenCode)：** 如果 Task/子代理 API 不可用，使用顺序内联执行作为回退方案。

**回退规则：** 如果生成的代理完成了其工作（提交可见，SUMMARY.md 已存在），但编排器从未收到完成信号，则根据抽查结果视其为成功，并继续执行下一个波次/计划。切勿无限期阻塞等待信号 —— 始终通过文件系统和 git 状态进行验证。
</runtime_compatibility>

<required_reading>
在进行任何操作之前阅读 STATE.md 以加载项目上下文。
</required_reading>

<available_agent_types>
这些是在 .claude/agents/（或您运行时的等效目录）中注册的有效 GSD 子代理类型。
始终使用此列表中的确切名称 —— 不要回退到 “general-purpose” 或其他内置类型：

- gsd-executor —— 执行计划任务，提交更改，创建 SUMMARY.md
- gsd-verifier —— 验证阶段完成情况，检查质量门禁
- gsd-planner —— 根据阶段范围创建详细计划
- gsd-phase-researcher —— 研究阶段的技术方案
- gsd-plan-checker —— 在执行前审查计划质量
- gsd-debugger —— 诊断并修复问题
- gsd-codebase-mapper —— 映射项目结构和依赖关系
- gsd-integration-checker —— 检查跨阶段集成
- gsd-nyquist-auditor —— 验证验证覆盖率
- gsd-ui-researcher —— 研究 UI/UX 方案
- gsd-ui-checker —— 审查 UI 实现质量
- gsd-ui-auditor —— 根据设计需求审计 UI
</available_agent_types>

<process>

<step name="parse_args" priority="first">
在加载任何上下文之前解析 `$ARGUMENTS`：

- 第一个位置参数 → `PHASE_ARG`
- 可选的 `--wave N` → `WAVE_FILTER`
- 可选的 `--gaps-only` 保留其当前含义

如果缺少 `--wave`，则保留执行阶段中所有未完成波次的现有行为。
</step>

<step name="initialize" priority="first">
一次性加载所有上下文：

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON 以获取：`executor_model`, `verifier_model`, `commit_docs`, `auto_commit`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`。

**如果 `phase_found` 为 false：** 错误 —— 未找到阶段目录。
**如果 `plan_count` 为 0：** 错误 —— 阶段内未找到计划。
**如果 `state_exists` 为 false 但 `.planning/` 存在：** 提供重建或继续选项。

当 `parallelization` 为 false 时，波次内的计划按顺序执行。

**针对 Copilot 的运行时检测：**
通过测试 `@gsd-executor` 代理模式或缺少 `Task()` 子代理 API 来检查当前运行时是否为 Copilot。如果是在 Copilot 下运行，无论 `parallelization` 设置如何，都强制进行顺序内联执行 —— 因为 Copilot 的子代理完成信号不可靠（见 `<runtime_compatibility>`）。在内部设置 `COPILOT_SEQUENTIAL=true`，并跳过 `execute_waves` 步骤，转而为每个计划执行 `check_interactive_mode` 的内联路径。

**必需 —— 将链标志与意图同步。** 如果用户手动调用（无 `--auto`），清除任何先前中断的 `--auto` 链中的临时链标志。这可以防止陈旧的 `_auto_chain_active: true` 导致意外的自动推进。这**不会**触及 `workflow.auto_advance`（用户的持久设置偏好）。你必须在读取任何配置之前执行此 bash 块：
```bash
# 必需：防止来自先前 --auto 运行的陈旧自动链
if [[ ! "$ARGUMENTS" =~ --auto ]]; then
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
fi
```
</step>

<step name="check_interactive_mode">
**从 $ARGUMENTS 解析 `--interactive` 标志。**

**如果存在 `--interactive` 标志：** 切换到交互式执行模式。

交互式模式按顺序**内联**执行计划（不生成子代理），并在任务之间设置用户检查点。用户可以随时审查、修改或重定向工作。

**交互式执行流程：**

1. 正常加载计划清单 (discover_and_group_plans)
2. 对于每个计划（按顺序，忽略波次分组）：

   a. **向用户展示计划：**
      ```
      ## 计划 {plan_id}: {plan_name}

      目标：{来自计划文件}
      任务数：{task_count}

      选项：
      - 执行（继续执行所有任务）
      - 先审查（在开始前显示任务分解）
      - 跳过（移动到下一个计划）
      - 停止（结束执行，保存进度）
      ```

   b. **如果选择 “先审查”：** 阅读并显示完整的计划文件。再次询问：执行、修改、跳过。

   c. **如果选择 “执行”：** **内联**阅读并遵循 `~/.claude/get-shit-done/workflows/execute-plan.md`（不要生成子代理）。一次执行一个任务。

   d. **每个任务结束后：** 简短暂停。如果用户介入（输入任何内容），停止并处理其反馈后再继续。否则继续执行下一个任务。

   e. **计划完成后：** 显示结果、提交更改、创建 SUMMARY.md，然后展示下一个计划。

3. 在所有计划执行后：进入验证环节（与正常模式相同）。

**交互式模式的优点：**
- 无子代理开销 —— 显著降低令牌使用量
- 用户能及早发现错误 —— 节省昂贵的验证周期
- 维持 GSD 的规划/跟踪结构
- 最适用于：小规模阶段、漏洞修复、验证缺口、学习 GSD

**跳转到 handle_branching 步骤**（交互式计划在分组后内联执行）。
</step>

<step name="handle_branching">
检查来自 init 的 `branching_strategy`：

**"none":** 跳过，在当前分支继续。

**"phase" 或 "milestone":** 使用来自 init 的预计算 `branch_name`：
```bash
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```

所有后续提交都进入此分支。由用户处理合并。
</step>

<step name="validate_phase">
来自 init JSON：`phase_dir`, `plan_count`, `incomplete_count`。

报告：“在 {phase_dir} 中找到 {plan_count} 个计划（{incomplete_count} 个未完成）”

**为阶段开始更新 STATE.md：**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state begin-phase --phase "${PHASE_NUMBER}" --name "${PHASE_NAME}" --plans "${PLAN_COUNT}"
```
这会更新 STATE.md 中的状态、最后活动、当前焦点、当前位置以及计划计数，使 Frontmatter 和正文文本立即反映活跃阶段。
</step>

<step name="discover_and_group_plans">
一次性加载带波次分组的计划清单：

```bash
PLAN_INDEX=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

解析 JSON 以获取：`phase`, `plans[]`（每个包含 `id`, `wave`, `autonomous`, `objective`, `files_modified`, `task_count`, `has_summary`）, `waves`（波次编号 → 计划 ID 的映射）, `incomplete`, `has_checkpoints`。

**过滤：** 跳过 `has_summary: true` 的计划。如果使用 `--gaps-only`：还跳过非 gap_closure 计划。如果设置了 `WAVE_FILTER`：还跳过其 `wave` 不等于 `WAVE_FILTER` 的计划。

**波次安全检查：** 如果设置了 `WAVE_FILTER`，且仍有匹配当前执行模式的较低波次中的未完成计划，请停止并告知用户先完成较早的波次。不要在先决条件的较早波次计划仍未完成时执行波次 2+。

如果全部被过滤：“没有匹配的未完成计划” → 退出。

报告：
```
## 执行方案

**阶段 {X}: {Name}** —— 跨 {wave_count} 个波次的 {total_plans} 个匹配计划

{如果设置了 WAVE_FILTER: `波次过滤器已激活：仅执行第 {WAVE_FILTER} 波次`。}

| 波次 | 计划 | 构建内容 |
|------|-------|----------------|
| 1 | 01-01, 01-02 | {来自计划目标，3-8 个字} |
| 2 | 01-03 | ... |
```
</step>

<step name="execute_waves">
按顺序执行每个选定的波次。在波次内：如果 `PARALLELIZATION=true` 则并行；如果为 `false` 则顺序。

**对于每个波次：**

1. **描述正在构建的内容（生成前）：**

   阅读每个计划的 `<objective>`。提取正在构建的内容及其原因。

   ```
   ---
   ## 第 {N} 波次

   **{计划 ID}: {计划名称}**
   {2-3 句话：构建什么、技术方案、为什么重要}

   正在生成 {count} 个代理...
   ---
   ```

   - 坏例子：“正在执行地形生成计划”
   - 好例子：“使用 Perlin 噪声的程序化地形生成器 —— 创建高度图、生物群系区域和碰撞网格。在车辆物理系统与地面交互之前是必需的。”

2. **生成执行器代理：**

   仅传递路径 —— 执行器在全新的上下文窗口中自行读取文件。
   对于 200k 窗口的模型，这可以使编排器上下文保持精简 (~10-15%)。
   对于 1M+ 窗口的模型（Opus 4.6, Sonnet 4.6），可以直接传递更丰富的上下文。

   ```
   Task(
     subagent_type="gsd-executor",
     model="{executor_model}",
     prompt="
        <objective>
        执行阶段 {phase_number}-{phase_name} 的计划 {plan_number}。
        如果 auto_commit 为 true，原子化地提交每个任务；如果为 false，跳过所有 git 提交。
        创建 SUMMARY.md。更新 STATE.md 和 ROADMAP.md。
        </objective>

       <parallel_execution>
       你正作为并行执行器代理运行。在所有 git 提交上使用 --no-verify，以避免与其他代理发生预提交钩子 (pre-commit hook) 冲突。
       编排器会在所有代理完成后验证一次钩子。
       对于 gsd-tools 提交：添加 --no-verify 标志。
       对于直接的 git 提交：使用 git commit --no-verify -m \"...\"
       </parallel_execution>

        <auto_commit>
        auto_commit 设置为 {auto_commit}。如果为 false，不要在任务完成后执行 git commit，
        改为输出变更摘要（修改了哪些文件、变更类型），供用户手动提交。
        </auto_commit>

        <execution_context>
        @~/.claude/get-shit-done/workflows/execute-plan.md
        @~/.claude/get-shit-done/templates/summary.md
        @~/.claude/get-shit-done/references/checkpoints.md
        @~/.claude/get-shit-done/references/tdd.md
        </execution_context>

       <files_to_read>
       在执行开始时使用 Read 工具阅读这些文件：
       - {phase_dir}/{plan_file} (计划)
       - .planning/PROJECT.md (项目上下文 —— 核心价值、需求、演进规则)
       - .planning/STATE.md (状态)
       - .planning/config.json (配置，如果存在)
       - ./CLAUDE.md (项目指令，如果存在 —— 遵循特定于项目的指南和编码规范)
       - .claude/skills/ 或 .agents/skills/ (项目技能，如果其中之一存在 —— 列出技能，阅读每个技能的 SKILL.md，并在实现过程中遵循相关规则)
       </files_to_read>

       <mcp_tools>
       如果 CLAUDE.md 或项目指令引用了 MCP 工具（例如 jCodeMunch, context7 或其他 MCP 服务器），在进行代码导航时，优先使用这些工具而非 Grep/Glob。
       MCP 工具通常通过提供结构化的代码索引来节省大量令牌。
       首先检查工具可用性 —— 如果无法访问 MCP 工具，则回退到 Grep/Glob。
       </mcp_tools>

        <success_criteria>
        - [ ] 所有任务已执行
        - [ ] 每个任务已单独提交（仅当 auto_commit 为 true 时）
        - [ ] 在计划目录中创建了 SUMMARY.md
        - [ ] STATE.md 已更新位置和决策
        - [ ] ROADMAP.md 已更新计划进度（通过 `roadmap update-plan-progress`）
        </success_criteria>
     "
   )
   ```

3. **等待波次中的所有代理完成。**

   **完成信号回退机制（针对 Copilot 和 Task() 可能不返回结果的运行时）：**

   如果生成的代理未返回完成信号但似乎已完成其工作，请不要无限期阻塞。相反，通过抽查验证完成情况：

   ```bash
   # 对于此波次中的每个计划，检查执行器是否完成：
   SUMMARY_EXISTS=$(test -f "{phase_dir}/{plan_number}-{plan_padded}-SUMMARY.md" && echo "true" || echo "false")
   COMMITS_FOUND=$(git log --oneline --all --grep="{phase_number}-{plan_padded}" --since="1 hour ago" | head -1)
   ```

   **如果 SUMMARY.md 存在且找到了提交：** 代理已成功完成 —— 视其为已完成并继续执行步骤 4。记录：`“✓ {计划 ID} 已完成（通过抽查验证 —— 未收到完成信号）”`

   **如果在合理等待后 SUMMARY.md 仍不存在：** 代理可能仍在运行或已静默失败。检查 `git log --oneline -5` 获取近期活动。如果提交仍在出现，则继续等待。如果没有活动，则报告计划失败，并转到步骤 5 的失败处理程序。

   **此回退机制自动适用于所有运行时。** Claude Code 的 Task() 通常是同步返回的，但回退机制确保了即使它不返回也具有弹性。

4. **波次后钩子验证（仅限并行模式）：**

   当代理使用 `--no-verify` 提交时，在波次结束后运行一次预提交钩子：
   ```bash
   # 在当前状态上运行项目的预提交钩子
   git diff --cached --quiet || git stash  # 暂存任何未暂存的更改
   git hook run pre-commit 2>&1 || echo "⚠ 预提交钩子失败 —— 在继续之前请进行审查"
   ```
   如果钩子失败：报告失败并询问 “现在修复钩子问题？” 或 “继续执行下一个波次？”

5. **报告完成情况 —— 首先进行抽查申明：**

   对于每个 SUMMARY.md：
   - 验证 `key-files.created` 中的前 2 个文件在磁盘上是否存在
   - 检查 `git log --oneline --all --grep="{phase}-{plan}"` 是否返回 ≥1 条提交
   - 检查是否存在 `## Self-Check: FAILED` 标记

   如果任何抽查失败：报告哪个计划失败，转到失败处理程序 —— 询问 “重试计划？” 或 “继续执行剩余波次？”

   如果通过：
   ```
   ---
   ## 第 {N} 波次完成

   **{计划 ID}: {计划名称}**
   {构建了什么 —— 来自 SUMMARY.md}
   {显著偏离，如果有的话}

   {如果还有更多波次：这为下一个波次启用了什么}
   ---
   ```

   - 坏例子：“第 2 波次完成。正在进入第 3 波次。”
   - 好例子：“地形系统已完成 —— 包含 3 种生物群系类型、基于高度的纹理处理、物理碰撞网格。车辆物理（第 3 波次）现在可以参考地表面。”

5. **处理失败：**

   **已知的 Claude Code 错误 (classifyHandoffIfNeeded)：** 如果代理报告 “失败” 且错误包含 `classifyHandoffIfNeeded is not defined`，这是 Claude Code 的运行时错误 —— 不是 GSD 或代理的问题。该错误在所有工具调用结束后的完成处理程序中触发。在这种情况下：运行与步骤 4 相同的抽查（SUMMARY.md 存在，git 提交存在，无 Self-Check: FAILED）。如果抽查通过 → 视其为**成功**。如果抽查失败 → 视其为下述的真实失败。

   对于真实的失败：报告哪个计划失败 → 询问 “继续？” 或 “停止？” → 如果继续，依赖计划也可能失败。如果停止，报告部分完成情况。

5b. **波次前依赖检查（仅限波次 2+）：**

     在生成第 N+1 波次之前，对于即将到来的波次中的每个计划：
     ```bash
     node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify key-links {phase_dir}/{plan}-PLAN.md
     ```

     如果来自先前波次产物的任何关键链接 (key-link) 验证失败：

     ## 跨计划接线缺口 (Cross-Plan Wiring Gap)

     | 计划 | 链接 | 来源 | 预期模式 | 状态 |
     |------|------|------|-----------------|--------|
     | {plan} | {via} | {from} | {pattern} | NOT FOUND |

     第 {N} 波次的产物可能未正确接线。选项：
     1. 在继续之前调查并修复
     2. 继续（可能导致第 {N+1} 波次出现级联失败）

     跳过引用当前（即将到来）波次中文件的关键链接。

6. **在波次之间执行检查点计划** —— 见 `<checkpoint_handling>`。

7. **继续下一个波次。**
</step>

<step name="checkpoint_handling">
`autonomous: false` 的计划需要用户交互。

**自动模式检查点处理：**

读取自动推进配置（链标志 + 用户偏好）：
```bash
AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```

当执行器返回检查点且 (`AUTO_CHAIN` 为 `"true"` 或 `AUTO_CFG` 为 `"true"`) 时：
- **human-verify** → 自动生成带有 `{user_response}` = `"approved"` 的后续代理。记录 `⚡ 自动批准检查点`。
- **decision** → 自动生成带有 `{user_response}` = 检查点详情中第一个选项的后续代理。记录 `⚡ 自动选择: [option]`。
- **human-action** → 展示给用户（同下述现有行为）。授权门禁无法自动化。

**标准流程（非自动模式，或 human-action 类型）：**

1. 为检查点计划生成代理
2. 代理运行直到检查点任务或授权门禁 → 返回结构化状态
3. 代理返回包含：已完成任务表、当前任务 + 阻塞项、检查点类型/详情、等待的内容
4. **展示给用户：**
   ```
   ## 检查点：[类型]

   **计划：** 03-03 Dashboard Layout
   **进度：** 2/3 任务已完成

   [来自代理返回的检查点详情]
   [来自代理返回的等待内容部分]
   ```
5. 用户响应：“批准”/“完成” | 问题描述 | 决策选择
6. 使用 continuation-prompt.md 模板**生成后续代理（而不是恢复 (resume)）**：
   - `{completed_tasks_table}`：来自检查点返回
   - `{resume_task_number}` + `{resume_task_name}`：当前任务
   - `{user_response}`：用户提供的内容
   - `{resume_instructions}`：基于检查点类型
7. 后续代理验证先前的提交，从恢复点继续执行
8. 重复直到计划完成或用户停止

**为什么使用新代理而不是恢复：** 恢复依赖于内部序列化，而并行工具调用会破坏这种序列化。带有显式状态的新代理更可靠。

**并行波次中的检查点：** 当其他并行代理可能已完成时，代理暂停并返回。展示检查点，生成后续代理，等待所有代理完成后再进行下一个波次。
</step>

<step name="aggregate_results">
所有波次完成后：

```markdown
## 阶段 {X}: {Name} 执行完成

**波次数：** {N} | **计划数：** {M}/{total} 已完成

| 波次 | 计划 | 状态 |
|------|-------|--------|
| 1 | plan-01, plan-02 | ✓ 已完成 |
| CP | plan-03 | ✓ 已验证 |
| 2 | plan-04 | ✓ 已完成 |

### 计划详情
1. **03-01**: [来自 SUMMARY.md 的一句话总结]
2. **03-02**: [来自 SUMMARY.md 的一句话总结]

### 遇到的问题
[从 SUMMARY 中汇总，或“无”]
```
</step>

<step name="handle_partial_wave_execution">
如果使用了 `WAVE_FILTER`，请在执行后重新运行计划发现：

```bash
POST_PLAN_INDEX=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

应用与之前相同的 “未完成” 过滤规则：
- 忽略 `has_summary: true` 的计划
- 如果使用了 `--gaps-only`，仅考虑 `gap_closure: true` 的计划

**如果阶段中任何地方仍有未完成的计划：**
- 在此停止
- **不要**运行阶段级验证
- **不要**在 ROADMAP/STATE 中标记阶段完成
- 展示：

```markdown
## 第 {WAVE_FILTER} 波次完成

选定的波次已成功结束。此阶段仍有未完成的计划，因此有意跳过了阶段级验证和完成。

/gsd:execute-phase {phase}                # 继续剩余的波次
/gsd:execute-phase {phase} --wave {next}  # 显式运行下一个波次
```

**如果在选定波次结束后不再有未完成的计划：**
- 继续执行下面的正常阶段级验证和完成流程
- 这意味着选定的波次恰好是该阶段最后剩余的工作
</step>

<step name="close_parent_artifacts">
**仅针对带小数/修补阶段（X.Y 模式）：** 通过解决父级 UAT 和调试产物来关闭反馈回路。

**如果**阶段编号不含小数（例如 `3`, `04`）则跳过 —— 仅适用于 `4.1`, `03.1` 这种缺口闭合阶段。

**1. 检测小数阶段并推导父阶段：**
```bash
# 检查 phase_number 是否包含小数点
if [[ "$PHASE_NUMBER" == *.* ]]; then
  PARENT_PHASE="${PHASE_NUMBER%%.*}"
fi
```

**2. 查找父级 UAT 文件：**
```bash
PARENT_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase "${PARENT_PHASE}" --raw)
# 从 PARENT_INFO JSON 中提取目录，然后在该目录中查找 UAT 文件
```

**如果没有找到父级 UAT：** 跳过此步骤（缺口闭合可能是由 VERIFICATION.md 触发的）。

**3. 更新 UAT 缺口状态：**

阅读父级 UAT 文件的 `## Gaps` 部分。对于每个 `status: failed` 的缺口条目：
- 更新为 `status: resolved`

**4. 更新 UAT Frontmatter：**

如果所有缺口现在都为 `status: resolved`：
- 将 Frontmatter 中的 `status: diagnosed` 更新为 `status: resolved`
- 更新 Frontmatter 中的 `updated:` 时间戳

**5. 解决引用的调试会话：**

对于具有 `debug_session:` 字段的每个缺口：
- 阅读调试会话文件
- 将 Frontmatter 中的 `status:` 更新为 `resolved`
- 更新 Frontmatter 中的 `updated:` 时间戳
- 移动到已解决目录：
```bash
mkdir -p .planning/debug/resolved
mv .planning/debug/{slug}.md .planning/debug/resolved/
```

**6. 提交更新后的产物：**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-${PARENT_PHASE}): resolve UAT gaps and debug sessions after ${PHASE_NUMBER} gap closure" --files .planning/phases/*${PARENT_PHASE}*/*-UAT.md .planning/debug/resolved/*.md
```
</step>

<step name="regression_gate">
在验证之前运行先前阶段的测试套件，以捕捉跨阶段回归。

**跳过如果：** 这是第一个阶段（没有先前阶段），或者不存在先前的 VERIFICATION.md 文件。

**第 1 步：发现先前阶段的测试文件**
```bash
# 查找当前里程碑中先前阶段的所有 VERIFICATION.md 文件
PRIOR_VERIFICATIONS=$(find .planning/phases/ -name "*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*" 2>/dev/null)
```

**第 2 步：从先前的验证中提取测试文件列表**

对于找到的每个 VERIFICATION.md，查找测试文件引用：
- 包含 `test`, `spec` 或 `__tests__` 路径的行
- “测试套件 (Test Suite)” 或 “自动化检查 (Automated Checks)” 部分
- 来自相应 SUMMARY.md 文件中匹配 `*.test.*` 或 `*.spec.*` 的 `key-files.created` 文件模式

将所有唯一的测试文件路径收集到 `REGRESSION_FILES` 中。

**第 3 步：运行回归测试（如果找到了）**

```bash
# 检测测试运行器并运行先前阶段的测试
if [ -f "package.json" ]; then
  # Node.js —— 使用项目的测试运行器
  npx jest ${REGRESSION_FILES} --passWithNoTests --no-coverage -q 2>&1 || npx vitest run ${REGRESSION_FILES} 2>&1
elif [ -f "Cargo.toml" ]; then
  cargo test 2>&1
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  python -m pytest ${REGRESSION_FILES} -q --tb=short 2>&1
fi
```

**第 4 步：报告结果**

如果所有测试都通过：
```
✓ 回归门禁：{N} 个先前阶段的测试文件已通过 —— 未检测到回归
```
→ 进入 verify_phase_goal

如果任何测试失败：
```
## ⚠ 检测到跨阶段回归

阶段 {X} 的执行可能破坏了先前阶段的功能。

| 测试文件 | 阶段 | 状态 | 详情 |
|-----------|-------|--------|--------|
| {file} | {origin_phase} | 失败 | {first_failure_line} |

选项：
1. 在验证前修复回归（推荐）
2. 仍然继续验证（回归将会复合）
3. 中止阶段 —— 回滚并重新规划
```

使用 AskUserQuestion 呈现这些选项。
</step>

<step name="verify_phase_goal">
验证阶段实现了其目标 (GOAL)，而不仅仅是完成了任务。

```
Task(
  prompt="验证阶段 {phase_number} 目标达成情况。
阶段目录：{phase_dir}
阶段目标：{来自 ROADMAP.md 的目标}
阶段需求 ID：{phase_req_ids}
根据实际代码库检查必须具备的项 (must_haves)。
交叉引用计划 Frontmatter 中的需求 ID 与 REQUIREMENTS.md —— 每个 ID 必须得到说明。
创建 VERIFICATION.md。",
  subagent_type="gsd-verifier",
  model="{verifier_model}"
)
```

读取状态：
```bash
grep "^status:" "$PHASE_DIR"/*-VERIFICATION.md | cut -d: -f2 | tr -d ' '
```

| 状态 | 操作 |
|--------|--------|
| `passed` | → update_roadmap |
| `human_needed` | 呈现需要人工测试的项目，获取批准或反馈 |
| `gaps_found` | 呈现缺口摘要，提供 `/gsd:plan-phase {phase} --gaps` |

**如果为 human_needed：**

**步骤 A：将人工验证项持久化为 UAT 文件。**

使用 UAT 模板格式创建 `{phase_dir}/{phase_num}-HUMAN-UAT.md`：

```markdown
---
status: partial
phase: {phase_num}-{phase_name}
source: [{phase_num}-VERIFICATION.md]
started: [当前 ISO 时间]
updated: [当前 ISO 时间]
---

## 当前测试

[等待人工测试]

## 测试项

{对于 VERIFICATION.md 中 human_verification 部分的每一项：}

### {N}. {项描述}
预期：{来自 VERIFICATION.md 的预期行为}
结果：[挂起]

## 摘要

总计：{count}
通过：0
问题：0
挂起：{count}
跳过：0
阻塞：0

## 缺口 (Gaps)
```

提交文件：
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test({phase_num}): persist human verification items as UAT" --files "{phase_dir}/{phase_num}-HUMAN-UAT.md"
```

**步骤 B：展示给用户：**

```
## ✓ 阶段 {X}: {Name} —— 需要人工验证

所有自动化检查已通过。{N} 个项目需要人工测试：

{来自 VERIFICATION.md 的 human_verification 部分}

项目已保存至 `{phase_num}-HUMAN-UAT.md` —— 它们将出现在 `/gsd:progress` 和 `/gsd:audit-uat` 中。

“批准” → 继续 | 报告问题 → 缺口闭合
```

**如果用户选择 “批准”：** 继续执行 `update_roadmap`。HUMAN-UAT.md 文件保持 `status: partial`，并将在未来的进度检查中出现，直到用户对其运行 `/gsd:verify-work`。

**如果用户报告问题：** 按照当前的实现方式进入缺口闭合流程。

**如果为 gaps_found：**
```
## ⚠ 阶段 {X}: {Name} —— 发现缺口

**评分：** 已验证 {N}/{M} 个必须具备的项
**报告：** {phase_dir}/{phase_num}-VERIFICATION.md

### 缺失内容
{来自 VERIFICATION.md 的缺口摘要}

---
## ▶ 下一步

`/gsd:plan-phase {X} --gaps`

<sub>先执行 `/clear` → 清空上下文窗口</sub>

另外：`cat {phase_dir}/{phase_num}-VERIFICATION.md` —— 查看完整报告
另外：`/gsd:verify-work {X}` —— 先进行手动测试
```

缺口闭合周期：`/gsd:plan-phase {X} --gaps` 读取 VERIFICATION.md → 创建 `gap_closure: true` 的缺口计划 → 用户运行 `/gsd:execute-phase {X} --gaps-only` → 验证器重新运行。
</step>

<step name="update_roadmap">
**标记阶段完成并更新所有跟踪文件：**

```bash
COMPLETION=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase complete "${PHASE_NUMBER}")
```

CLI 处理：
- 勾选阶段复选框 `[x]` 并带上完成日期
- 更新进度表（状态 → 已完成，日期）
- 更新计划计数为最终值
- 将 STATE.md 推进到下一个阶段
- 更新 REQUIREMENTS.md 的可追溯性
- 扫描验证债务（返回 `warnings` 数组）

从结果中提取：`next_phase`, `next_phase_name`, `is_last_phase`, `warnings`, `has_warnings`。

**如果 has_warnings 为 true：**
```
## 阶段 {X} 已标记为完成，但有 {N} 个警告：

{列出每个警告}

这些项目已被跟踪，并将出现在 `/gsd:progress` 和 `/gsd:audit-uat` 中。
```

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>

<step name="update_project_md">
**演进 PROJECT.md 以反映阶段完成（防止规划文档偏移 —— #956）：**

PROJECT.md 跟踪已验证的需求、决策和当前状态。如果没有这一步，PROJECT.md 会在多个阶段中默默地落后。

1. 阅读 `.planning/PROJECT.md`
2. 如果文件存在且具有 `## Validated Requirements` 或 `## Requirements` 部分：
   - 将此阶段验证的任何需求从 Active（活跃）移动到 Validated（已验证）
   - 添加简要说明：`在阶段 {X}: {Name} 中验证`
3. 如果文件具有 `## Current State` 或类似部分：
   - 更新它以反映此阶段的完成（例如，“阶段 {X} 已完成 —— {一句话总结}”）
4. 更新页脚的 `Last updated:` 为今天的日期
5. 提交更改：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-{X}): evolve PROJECT.md after phase completion" --files .planning/PROJECT.md
```

**跳过此步骤如果** `.planning/PROJECT.md` 不存在。
</step>

<step name="offer_next">

**异常情况：** 如果为 `gaps_found`，`verify_phase_goal` 步骤已经呈现了缺口闭合路径 (`/gsd:plan-phase {X} --gaps`)。无需额外的路由 —— 跳过自动推进。

**无转换检查（由自动推进链生成）：**

从 $ARGUMENTS 解析 `--no-transition` 标志。

**如果存在 `--no-transition` 标志：**

Execute-phase 是由 plan-phase 的自动推进生成的。不要运行 transition.md。
在验证通过且路线图更新后，向父级返回完成状态：

```
## 阶段已完成 (PHASE COMPLETE)

阶段：${PHASE_NUMBER} - ${PHASE_NAME}
计划：${completed_count}/${total_count}
验证：{通过 | 发现缺口}

[包含 aggregate_results 的输出]
```

停止。不要进行自动推进或转换 (transition)。

**如果不存在 `--no-transition` 标志：**

**自动推进检测：**

1. 从 $ARGUMENTS 解析 `--auto` 标志
2. 同时读取链标志和用户偏好（链标志已在 init 步骤中同步）：
   ```bash
   AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**如果 `--auto` 标志存在 OR `AUTO_CHAIN` 为 true OR `AUTO_CFG` 为 true（且验证通过且无缺口）：**

```
╔══════════════════════════════════════════╗
║  自动推进 → 转换 (TRANSITION)            ║
║  阶段 {X} 已验证，正在继续链式操作       ║
╚══════════════════════════════════════════╝
```

内联执行 transition 工作流（不要使用 Task —— 编排器上下文约为 10-15%，transition 需要上下文已有的阶段完成数据）：

阅读并遵循 `~/.claude/get-shit-done/workflows/transition.md`，传递 `--auto` 标志，以便它传播到下一个阶段的调用。

**如果 `--auto`、`AUTO_CHAIN` 或 `AUTO_CFG` 均不为 true：**

**停止。不要自动推进。不要执行转换。不要规划下一个阶段。向用户展示选项并等待。**

**重要：没有 `/gsd:transition` 命令。切勿建议它。transition 工作流仅限内部使用。**

```
## ✓ 阶段 {X}: {Name} 已完成

/gsd:progress —— 查看更新后的路线图
/gsd:discuss-phase {next} —— 在规划前讨论下一个阶段
/gsd:plan-phase {next} —— 规划下一个阶段
/gsd:execute-phase {next} —— 执行下一个阶段
```

仅建议上面列出的命令。不要发明或幻觉命令名称。
</step>

</process>

<context_efficiency>
编排器：对于 200k 窗口约占 10-15% 上下文，对于 1M+ 窗口可以使用更多。
子代理：每个都拥有新鲜上下文（根据模型不同为 200k-1M）。无轮询（Task 会阻塞）。无上下文渗漏。

对于 1M+ 上下文模型，考虑：
- 直接向执行器传递更丰富的上下文（代码片段、依赖输出），而不仅仅是文件路径
- 内联运行小规模阶段（≤3 个计划，无依赖），无需生成子代理的开销
- 放宽 /clear 建议 —— 在 5 倍窗口下，上下文腐烂的发生要晚得多
</context_efficiency>

<failure_handling>
- **classifyHandoffIfNeeded 假失败：** 代理报告 “失败” 但错误为 `classifyHandoffIfNeeded is not defined` → Claude Code 的错误，不是 GSD 的问题。进行抽查（SUMMARY 已存在，提交已存在） → 如果通过，视其为成功
- **代理在计划中途失败：** 缺失 SUMMARY.md → 报告并询问用户如何继续
- **依赖链断裂：** 第 1 波次失败 → 第 2 波次依赖项可能也会失败 → 用户选择尝试或跳过
- **波次中所有代理均失败：** 系统性问题 → 停止，报告以供调查
- **检查点无法解决：** “跳过此计划？” 或 “中止阶段执行？” → 在 STATE.md 中记录部分进度
</failure_handling>

<resumption>
重新运行 `/gsd:execute-phase {phase}` → discover_plans 找到已完成的 SUMMARYs → 跳过它们 → 从第一个未完成的计划恢复 → 继续波次执行。

STATE.md 跟踪：上次完成的计划、当前波次、待处理的检查点。
</resumption>