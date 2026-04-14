<purpose>
执行阶段指令 (PLAN.md) 并创建结果摘要 (SUMMARY.md)。
</purpose>

<required_reading>
在进行任何操作前阅读 STATE.md 以加载项目上下文。
阅读 config.json 获取规划行为设置。

@~/.claude/get-shit-done/references/git-integration.md
</required_reading>

<process>

<step name="init_context" priority="first">
加载执行上下文（仅路径，以最小化编排器上下文）：

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 中提取：`executor_model`, `commit_docs`, `sub_repos`, `phase_dir`, `phase_number`, `plans`, `summaries`, `incomplete_plans`, `state_path`, `config_path`。

如果缺少 `.planning/`：报错。
</step>

<step name="identify_plan">
```bash
# 使用来自 INIT JSON 的 plans/summaries，或列出文件
ls .planning/phases/XX-name/*-PLAN.md 2>/dev/null | sort
ls .planning/phases/XX-name/*-SUMMARY.md 2>/dev/null | sort
```

找到第一个没有对应 SUMMARY 的 PLAN。支持小数阶段 (`01.1-hotfix/`)：

```bash
PHASE=$(echo "$PLAN_PATH" | grep -oE '[0-9]+(\.[0-9]+)?-[0-9]+')
# 如果需要，可以通过 gsd-tools config-get 获取配置设置
```

<if mode="yolo">
自动批准：`⚡ 执行 {phase}-{plan}-PLAN.md [阶段 Z 的第 X/Y 个计划]` → parse_segments。
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
展示计划标识，等待确认。
</if>
</step>

<step name="record_start_time">
```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```
</step>

<step name="parse_segments">
```bash
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

**按检查点类型路由：**

| 检查点 | 模式 | 执行方式 |
|-------------|---------|-----------|
| 无 | A (自主) | 单一子代理：执行完整计划 + 生成 SUMMARY + 提交 |
| 仅验证 (Verify-only) | B (分段) | 检查点之间的分段执行。none/human-verify 之后 → 子代理执行。decision/human-action 之后 → 主代理执行 |
| 决策 (Decision) | C (主代理) | 完全在主上下文中执行 |

**模式 A：** init_agent_tracking → 生成 Task(subagent_type="gsd-executor", model=executor_model)，提示词：执行位于 [path] 的计划，自主模式，完成所有任务 + 生成 SUMMARY + 提交，遵循偏离/授权规则，报告：计划名称、任务、SUMMARY 路径、提交哈希 → 跟踪 agent_id → 等待 → 更新跟踪 → 报告。

**模式 B：** 按分段执行。自主分段：仅为分配的任务生成子代理（不生成 SUMMARY/提交）。检查点：在主上下文中处理。所有分段完成后：汇总、创建 SUMMARY、提交。详见 segment_execution。

**模式 C：** 使用标准流程（步骤名为 “execute”）在主上下文中执行。

为每个子代理提供新鲜上下文可保持最高质量。主上下文保持精简。
</step>

<step name="init_agent_tracking">
```bash
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
rm -f .planning/current-agent-id.txt
if [ -f .planning/current-agent-id.txt ]; then
  INTERRUPTED_ID=$(cat .planning/current-agent-id.txt)
  echo "发现中断的代理：$INTERRUPTED_ID"
fi
```

如果被中断：询问用户恢复（使用 Task 的 `resume` 参数）或重新开始。

**跟踪协议：** 生成代理时：将 agent_id 写入 `current-agent-id.txt`，向 agent-history.json 追加：`{"agent_id":"[id]","task_description":"[desc]","phase":"[phase]","plan":"[plan]","segment":[num|null],"timestamp":"[ISO]","status":"spawned","completion_timestamp":null}`。完成时：status → "completed"，设置 completion_timestamp，删除 current-agent-id.txt。清理：如果条目超过 max_entries，删除最早的 "completed"（绝不删除 "spawned"）。

在生成代理前为模式 A/B 运行。模式 C：跳过。
</step>

<step name="segment_execution">
仅限模式 B（仅验证检查点）。模式 A/C 跳过。

1. 解析分段图：检查点位置和类型
2. 对于每个分段：
   - 子代理路由：仅为分配的任务生成 gsd-executor。提示词：任务范围、计划路径、阅读完整计划以获取上下文、执行分配的任务、跟踪偏离情况，不生成 SUMMARY/提交。通过代理协议进行跟踪。
   - 主代理路由：使用标准流程执行任务（步骤名为 “execute”）
3. 所有分段完成后：汇总文件/偏离/决策 → 创建 SUMMARY.md → 提交 → 自检：
   - 使用 `[ -f ]` 验证磁盘上是否存在 key-files.created 中的文件
   - 检查 `git log --oneline --all --grep="{phase}-{plan}"` 是否返回 ≥1 条提交
   - 向 SUMMARY 追加 `## Self-Check: PASSED` 或 `## Self-Check: FAILED`

   **已知的 Claude Code 错误 (classifyHandoffIfNeeded)：** 如果任何分段代理报告 “失败” 且错误为 `classifyHandoffIfNeeded is not defined`，这是 Claude Code 的运行时错误 —— 不是真实的失败。进行抽查；如果通过，视其为成功。
</step>

<step name="load_prompt">
```bash
cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```
这就是执行指令。请严格遵守。如果计划引用了 CONTEXT.md：在整个过程中尊重用户的愿景。

**如果计划包含 `<interfaces>` 块：** 这些是预先提取的类型定义和契约。直接使用它们 —— 不要为了发现类型而重新阅读源文件。规划器已经提取了你需要的内容。
</step>

<step name="previous_phase_check">
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phases list --type summaries --raw
# 从 JSON 结果中提取倒数第二个摘要
```
如果之前的 SUMMARY 有未解决的 “遇到的问题” 或 “下一阶段准备就绪” 阻塞项：AskUserQuestion（标题=“先前的问题”，选项：“仍然继续” | “先处理” | “查看先前内容”）。
</step>

<step name="execute">
偏离计划是正常的 —— 通过以下规则处理。

1. 从提示词中阅读 @context 文件
2. **MCP 工具：** 如果 CLAUDE.md 或项目指令引用了 MCP 工具（例如用于代码导航的 jCodeMunch），在可用时优先于 Grep/Glob 使用。如果无法访问 MCP 工具，则回退到 Grep/Glob。
3. 对于每个任务：
   - **强制执行 read_first 门禁：** 如果任务具有 `<read_first>` 字段，你必须在进行任何编辑之前阅读列出的每个文件。这不是可选的。不要因为你“已经知道”其中的内容而跳过文件 —— 阅读它们。read_first 文件为任务确立了基本事实。
   - `type="auto"`：如果 `tdd="true"` → 执行 TDD。应用偏离规则 + 授权门禁进行实现。验证完成标准。提交（见 task_commit）。记录哈希值用于摘要。
   - `type="checkpoint:*"`：停止执行 → 检查点协议 (checkpoint_protocol) → 等待用户 → 仅在确认后继续。
   - **强制执行验收标准 (acceptance_criteria) 检查：** 完成每个任务后，如果它具有 `<acceptance_criteria>`，在移动到下一个任务前验证每一项标准。使用 grep、文件读取或 CLI 命令确认每项标准。如果任何标准失败，在继续前修复实现。不要跳过标准或将其标记为“稍后验证”。
3. 运行 `<verification>` 检查
4. 确认满足 `<success_criteria>`
5. 在摘要中记录偏离情况
</step>

<authentication_gates>

## 授权门禁

执行期间的授权错误并非失败 —— 它们是预期的交互点。

**指标：** "Not authenticated", "Unauthorized", 401/403, "Please run {tool} login", "Set {ENV_VAR}"

**协议：**
1. 识别授权门禁（不是漏洞）
2. 停止任务执行
3. 创建带有精确授权步骤的动态 checkpoint:human-action
4. 等待用户进行身份验证
5. 验证凭据是否有效
6. 重试原始任务
7. 正常继续

**示例：** `vercel --yes` → "Not authenticated" → 检查点要求用户执行 `vercel login` → 通过 `vercel whoami` 验证 → 重试部署 → 继续

**在摘要中：** 记录在 “## 授权门禁” 下的正常流程中，不要作为偏离记录。

</authentication_gates>

<deviation_rules>

## 偏离规则

你将会发现未计划的工作。自动应用，并为摘要跟踪所有项。

| 规则 | 触发条件 | 动作 | 权限 |
|------|---------|--------|------------|
| **1: 漏洞 (Bug)** | 损坏的行为、错误、错误的查询、类型错误、安全漏洞、竞态条件、泄漏 | 修复 → 测试 → 验证 → 跟踪 `[Rule 1 - Bug]` | 自动 |
| **2: 缺失关键项** | 缺失核心要素：错误处理、验证、授权、CSRF/CORS、速率限制、索引、日志 | 添加 → 测试 → 验证 → 跟踪 `[Rule 2 - Missing Critical]` | 自动 |
| **3: 阻塞项** | 阻碍完成：缺失依赖、错误类型、损坏的导入、缺失环境变量/配置/文件、循环依赖 | 修复阻塞项 → 验证进度 → 跟踪 `[Rule 3 - Blocking]` | 自动 |
| **4: 架构性决策** | 结构性变更：新数据库表、架构变更、新服务、切换库、破坏性 API、新基础设施 | 停止执行 → 提交决策（见下文） → 跟踪 `[Rule 4 - Architectural]` | 询问用户 |

**规则 4 格式：**
```
⚠️ 需要架构性决策

当前任务：[任务名称]
发现情况：[触发此决策的原因]
建议变更：[修改内容]
为什么需要：[原理解释]
影响：[这会影响什么]
替代方案：[其他方法]

是否继续执行建议的变更？ (是 / 使用不同方法 / 推迟)
```

**优先级：** 规则 4 (停止) > 规则 1-3 (自动) > 不确定 → 规则 4
**边缘情况：** 缺失验证 → R2 | 空指针崩溃 → R1 | 新表 → R4 | 新列 → R1/2
**启发式标准：** 是否影响正确性/安全性/完成？ → R1-3。可能影响？ → R4。

</deviation_rules>

<deviation_documentation>

## 记录偏离情况

摘要必须包含偏离部分。如果没有？ → `## 偏离计划\n\n无 —— 计划完全按照书面内容执行。`

针对每个偏离项：**[Rule N - 类别] 标题** —— 发现于：任务 X | 问题 | 修复方案 | 修改的文件 | 验证情况 | 提交哈希

最后以以下内容结束：**总偏离项：** N 个自动修复（包含明细）。**影响：** 评估结论。

</deviation_documentation>

<tdd_plan_execution>
## TDD 执行

针对 `type: tdd` 的计划 —— 红-绿-重构：

1. **基础设施**（仅限第一个 TDD 计划）：检测项目、安装框架、配置、验证空套件
2. **红 (RED)：** 阅读 `<behavior>` → 编写失败的测试 → 运行（必须失败） → 提交：`test({phase}-{plan}): 为 [功能] 添加失败的测试`
3. **绿 (GREEN)：** 阅读 `<implementation>` → 编写最简代码 → 运行（必须通过） → 提交：`feat({phase}-{plan}): 实现 [功能]`
4. **重构 (REFACTOR)：** 清理代码 → 测试必须通过 → 提交：`refactor({phase}-{plan}): 清理 [功能] 代码`

错误处理：RED 未失败 → 调查测试/现有功能。GREEN 未通过 → 调试、迭代。REFACTOR 破坏了功能 → 撤销。

详见 `~/.claude/get-shit-done/references/tdd.md` 以了解结构。
</tdd_plan_execution>

<precommit_failure_handling>
## 预提交钩子 (Pre-commit Hook) 失败处理

你的提交可能会触发预提交钩子。自动修复钩子会自动处理 —— 文件会被自动修复并重新暂存。

**如果作为并行执行器代理运行（由 execute-phase 生成）：**
在所有提交上使用 `--no-verify`。当多个代理同时提交时（例如 Rust 项目中的 cargo lock 竞争），预提交钩子会导致构建锁竞争。编排器会在所有代理完成后验证一次。

**如果作为唯一执行器运行（顺序模式）：**
如果提交被钩子阻塞：

1. `git commit` 命令失败，并输出钩子错误信息
2. 阅读错误 —— 它会告诉你确切的钩子及其失败原因
3. 修复问题（类型错误、代码规范违规、密钥泄露等）
4. `git add` 修复后的文件
5. 重试提交
6. 为每个提交预留 1-2 次重试周期
</precommit_failure_handling>

<task_commit>
## 任务提交协议

每个任务（验证通过、满足完成标准）完成后，立即提交。

**0. 检查 auto_commit：** 如果 init 上下文中 `auto_commit` 为 `false`，跳过以下所有 git 提交步骤。改为输出变更摘要（修改了哪些文件、变更类型），供用户手动提交，然后直接跳到下一个任务。

**1. 检查：** `git status --short`

**2. 单独暂存**（绝不使用 `git add .` 或 `git add -A`）：
```bash
git add src/api/auth.ts
git add src/types/user.ts
```

**3. 提交类型：**

| 类型 | 适用场景 | 示例 |
|------|------|---------|
| `feat` | 新功能 | feat(08-02): 创建用户注册端点 |
| `fix` | 漏洞修复 | fix(08-02): 修正电子邮件验证正则表达式 |
| `test` | 仅测试 (TDD RED) | test(08-02): 为密码哈希添加失败的测试 |
| `refactor` | 无行为变更 (TDD REFACTOR) | refactor(08-02): 将验证提取到辅助函数中 |
| `perf` | 性能优化 | perf(08-02): 添加数据库索引 |
| `docs` | 文档编写 | docs(08-02): 添加 API 文档 |
| `style` | 格式化 | style(08-02): 格式化 auth 模块 |
| `chore` | 配置/依赖 | chore(08-02): 添加 bcrypt 依赖 |

**4. 格式：** `{type}({phase}-{plan}): {description}`，并使用要点列出关键变更。

<sub_repos_commit_flow>
**子仓库模式：** 如果配置了 `sub_repos`（来自 init 上下文的非空数组），使用 `commit-to-subrepo` 而非标准的 git 提交。这会根据路径前缀将文件路由到正确的子仓库。

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit-to-subrepo "{type}({phase}-{plan}): {description}" --files file1 file2 ...
```

该命令按子仓库前缀对文件进行分组，并原子化地提交到每个子仓库。返回 JSON：`{ committed: true, repos: { "backend": { hash: "abc", files: [...] }, ... } }`。

记录响应中每个仓库的哈希值用于 SUMMARY 跟踪。

**如果 `sub_repos` 为空或未设置：** 使用下述标准 git 提交流程。
</sub_repos_commit_flow>

**5. 记录哈希值：**
```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
TASK_COMMITS+=("任务 ${TASK_NUM}: ${TASK_COMMIT}")
```

**6. 检查未跟踪的生成文件：**
```bash
git status --short | grep '^??'
```
如果在运行脚本或工具后出现了新的未跟踪文件，请为每个文件做决定：
- **提交它** —— 如果它是源文件、配置或有意的产物
- **添加到 .gitignore** —— 如果它是生成的/运行时输出（构建产物、`.env` 文件、缓存文件、编译后的输出）
- 不要让生成的文件处于未跟踪状态

</task_commit>

<step name="checkpoint_protocol">
遇到 `type="checkpoint:*"` 时：首先自动完成所有可能的操作。检查点仅用于验证/决策。

显示：`CHECKPOINT: [Type]` 框 → 进度 {X}/{Y} → 任务名称 → 类型特定内容 → `YOUR ACTION: [signal]`

| 类型 | 内容 | 恢复信号 |
|------|---------|---------------|
| 人工验证 (human-verify) (90%) | 构建的内容 + 验证步骤（命令/URL） | “approved” 或描述问题 |
| 决策 (decision) (9%) | 需要决策 + 上下文 + 带优缺点的选项 | “Select: option-id” |
| 人工操作 (human-action) (1%) | 已自动化的内容 + 一个手动步骤 + 验证计划 | “done” |

响应后：如果指定了则进行验证。通过 → 继续。失败 → 告知并等待。等待用户 —— **不要**幻觉完成。

详见 ~/.claude/get-shit-done/references/checkpoints.md 获取详情。
</step>

<step name="checkpoint_return_for_orchestrator">
通过 Task 生成且遇到检查点时：返回结构化状态（无法直接与用户交互）。

**必需的返回内容：** 1) 已完成任务表（哈希 + 文件） 2) 当前任务（阻塞项） 3) 检查点详情（面向用户的内容） 4) 等待项（需要用户提供的内容）

编排器解析后 → 呈现给用户 → 产生带有你已完成任务状态的新后续代理。你将不会被恢复 (resume)。在主上下文中：使用上述检查点协议。
</step>

<step name="verification_failure_gate">
如果验证失败：

**检查是否启用了节点修复 (node repair)**（默认开启）：
```bash
NODE_REPAIR=$(node "./.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.node_repair 2>/dev/null || echo "true")
```

如果 `NODE_REPAIR` 为 `true`：调用 `@./.claude/get-shit-done/workflows/node-repair.md`，参数如下：
- FAILED_TASK：任务编号、名称、完成标准
- ERROR：预期结果 vs 实际结果
- PLAN_CONTEXT：相邻任务名称 + 阶段目标
- REPAIR_BUDGET：配置中的 `workflow.node_repair_budget`（默认：2）

节点修复将自主尝试 RETRY（重试）、DECOMPOSE（分解）或 PRUNE（修剪）。仅在修复预算耗尽时才会再次到达此关口 (ESCALATE)。

如果 `NODE_REPAIR` 为 `false` 或修复返回 ESCALATE：停止。展示：“任务 [X] 验证失败：[名称]。预期：[标准]。实际：[结果]。尝试修复：[尝试内容的摘要]。” 选项：重试 | 跳过（标记为未完成） | 停止（进行调查）。如果跳过 → 在 SUMMARY 中记录 “遇到的问题”。
</step>

<step name="record_completion_time">
```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))

if [[ $DURATION_MIN -ge 60 ]]; then
  HRS=$(( DURATION_MIN / 60 ))
  MIN=$(( DURATION_MIN % 60 ))
  DURATION="${HRS}h ${MIN}m"
else
  DURATION="${DURATION_MIN} 分钟"
fi
```
</step>

<step name="generate_user_setup">
```bash
grep -A 50 "^user_setup:" .planning/phases/XX-name/{phase}-{plan}-PLAN.md | head -50
```

如果存在 user_setup：使用模板 `~/.claude/get-shit-done/templates/user-setup.md` 创建 `{phase}-USER-SETUP.md`。针对每个服务：环境变量表、账户设置核查表、仪表板配置、本地开发笔记、验证命令。状态为 “未完成”。设置 `USER_SETUP_CREATED=true`。如果为空/缺失：跳过。
</step>

<step name="create_summary">
在 `.planning/phases/XX-name/` 创建 `{phase}-{plan}-SUMMARY.md`。使用 `~/.claude/get-shit-done/templates/summary.md`。

**Frontmatter：** phase, plan, subsystem, tags | requires/provides/affects | tech-stack.added/patterns | key-files.created/modified | key-decisions | requirements-completed（**必须**逐字复制 PLAN.md frontmatter 中的 requirements 数组） | duration ($DURATION), completed ($PLAN_END_TIME 日期)。

标题：`# 阶段 [X] 计划 [Y]：[名称] 摘要`

实质性的一句话总结：使用 “使用 jose 库进行带刷新轮转的 JWT 身份验证” 而非 “已实现身份验证”。

包含：耗时、开始/结束时间、任务数、文件数。

下一步：更多计划 → “Ready for {next-plan}” | 最后一个计划 → “阶段已完成，准备进行下一步”。
</step>

<step name="update_current_position">
使用 gsd-tools 更新 STATE.md：

```bash
# 推进计划计数器（处理最后一个计划的边缘情况）
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state advance-plan

# 从磁盘状态重新计算进度条
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state update-progress

# 记录执行指标
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state record-metric \
  --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}" \
  --tasks "${TASK_COUNT}" --files "${FILE_COUNT}"
```
</step>

<step name="extract_decisions_and_issues">
从 SUMMARY 中：提取决策并添加到 STATE.md：

```bash
# 从 SUMMARY 的 key-decisions 中添加每个决策
# 优先使用文件输入以获取 Shell 安全的文本（精确保留 `$`, `*` 等）
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state add-decision \
  --phase "${PHASE}" --summary-file "${DECISION_TEXT_FILE}" --rationale-file "${RATIONALE_FILE}"

# 如果发现阻塞项，则添加
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state add-blocker --text-file "${BLOCKER_TEXT_FILE}"
```
</step>

<step name="update_session_continuity">
使用 gsd-tools 更新会话信息：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state record-session \
  --stopped-at "已完成 ${PHASE}-${PLAN}-PLAN.md" \
  --resume-file "None"
```

保持 STATE.md 在 150 行以内。
</step>

<step name="issues_review_gate">
如果 SUMMARY 中的 “遇到的问题” ≠ “无”：yolo 模式 → 记录并继续。交互模式 → 呈现问题，等待确认。
</step>

<step name="update_roadmap">
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap update-plan-progress "${PHASE}"
```
统计磁盘上的 PLAN 与 SUMMARY 文件。使用正确的计数和状态（`In Progress` 或带日期的 `Complete`）更新进度表行。
</step>

<step name="update_requirements">
标记 PLAN.md frontmatter `requirements:` 字段中完成的需求：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" requirements mark-complete ${REQ_IDS}
```

从计划的 Frontmatter 提取需求 ID（例如 `requirements: [AUTH-01, AUTH-02]`）。如果没有需求字段，则跳过。
</step>

<step name="git_commit_metadata">
任务代码已在每个任务中提交。提交计划元数据：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs({phase}-{plan}): 完成 [plan-name] 计划" --files .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```
</step>

<step name="update_codebase_map">
如果 .planning/codebase/ 不存在：跳过。

```bash
FIRST_TASK=$(git log --oneline --grep="feat({phase}-{plan}):" --grep="fix({phase}-{plan}):" --grep="test({phase}-{plan}):" --reverse | head -1 | cut -d' ' -f1)
git diff --name-only ${FIRST_TASK}^..HEAD 2>/dev/null
```

仅更新结构性变更：新 src/ 目录 → STRUCTURE.md | 依赖项 → STACK.md | 文件模式 → CONVENTIONS.md | API 客户端 → INTEGRATIONS.md | 配置 → STACK.md | 重命名 → 更新路径。跳过纯代码/漏洞修复/内容变更。

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "" --files .planning/codebase/*.md --amend
```
</step>

<step name="offer_next">
如果 `USER_SETUP_CREATED=true`：在最上方显著显示 `⚠️ 需要用户设置` 及其路径 + 环境/配置任务。

```bash
ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

| 条件 | 路由 | 操作 |
|-----------|-------|--------|
| summaries < plans | **A: 更多计划** | 找到下一个没有 SUMMARY 的 PLAN。Yolo 模式：自动继续。交互模式：显示下一个计划，建议 `/gsd:execute-phase {phase}` + `/gsd:verify-work`。在此停止。 |
| summaries = plans, 当前 < 最高阶段 | **B: 阶段已完成** | 显示完成情况，建议 `/gsd:plan-phase {Z+1}` + `/gsd:verify-work {Z}` + `/gsd:discuss-phase {Z+1}` |
| summaries = plans, 当前 = 最高阶段 | **C: 里程碑已完成** | 显示横幅，建议 `/gsd:complete-milestone` + `/gsd:verify-work` + `/gsd:add-phase` |

所有路由：先执行 `/clear` 以获取新鲜上下文。
</step>

</process>

<success_criteria>

- 完成了 PLAN.md 中的所有任务
- 所有验证均通过
- 如果 Frontmatter 中有 user_setup，则生成了 USER-SETUP.md
- 创建了具有实质性内容的 SUMMARY.md
- 更新了 STATE.md（位置、决策、问题、会话）
- 更新了 ROADMAP.md
- 如果代码库映射存在：使用执行过程中的变更更新了映射（若无重大变更则跳过）
- 如果创建了 USER-SETUP.md：在完成输出中显著呈现
</success_criteria>