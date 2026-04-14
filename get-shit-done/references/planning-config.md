<planning_config>

用于配置 `.planning/` 目录行为的选项。

<config_schema>
```json
"planning": {
  "commit_docs": true,
  "search_gitignored": false
},
"workflow": {
  "auto_commit": true
},
"git": {
  "branching_strategy": "none",
  "phase_branch_template": "gsd/phase-{phase}-{slug}",
  "milestone_branch_template": "gsd/{milestone}-{slug}",
  "quick_branch_template": null
}
```

| 选项 | 默认值 | 描述 |
|--------|---------|-------------|
| `commit_docs` | `true` | 是否将计划产物提交到 git |
| `search_gitignored` | `false` | 为广泛的 rg 搜索添加 `--no-ignore` 标志 |
| `workflow.auto_commit` | `true` | 执行阶段完成任务后是否自动 git commit 代码 |
| `git.branching_strategy` | `"none"` | Git 分支策略：`"none"`, `"phase"`, 或 `"milestone"` |
| `git.phase_branch_template` | `"gsd/phase-{phase}-{slug}"` | 阶段策略的分支模板 |
| `git.milestone_branch_template` | `"gsd/{milestone}-{slug}"` | 里程碑策略的分支模板 |
| `git.quick_branch_template` | `null` | 快速任务运行的可选分支模板 |
</config_schema>

<commit_docs_behavior>

**当 `commit_docs: true` (默认) 时：**
- 计划文件正常提交
- SUMMARY.md, STATE.md, ROADMAP.md 在 git 中进行跟踪
- 保留计划决策的完整历史记录

**当 `commit_docs: false` 时：**
- 跳过对 `.planning/` 文件的所有 `git add`/`git commit` 操作
- 用户必须将 `.planning/` 添加到 `.gitignore` 中
- 适用场景：开源项目贡献、客户项目、保持计划私有

**使用 gsd-tools.cjs (推荐)：**

```bash
# 进行带有自动 commit_docs + gitignore 检查的提交：
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: update state" --files .planning/STATE.md

# 通过 state load 加载配置（返回 JSON）：
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# commit_docs 在 JSON 输出中可用

# 或者使用包含 commit_docs 的 init 命令：
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# 所有 init 命令输出中都包含 commit_docs
```

**自动检测：** 如果 `.planning/` 被 gitignore 了，无论 config.json 如何设置，`commit_docs` 都会自动变为 `false`。这可以防止在用户将 `.planning/` 放入 `.gitignore` 时产生 git 错误。

**通过 CLI 提交（自动处理检查）：**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: update state" --files .planning/STATE.md
```

CLI 会在内部检查 `commit_docs` 配置和 gitignore 状态 —— 无需手动编写条件判断。

</commit_docs_behavior>

<auto_commit_behavior>

**当 `workflow.auto_commit: true` (默认) 时：**
- 执行器在每个任务完成后自动执行 `git add` + `git commit`
- 标准的 execute-plan 任务提交协议（`<task_commit>`）正常运行
- 每个任务产生一个原子提交，包含 conventional commit 格式的消息

**当 `workflow.auto_commit: false` 时：**
- 执行器跳过所有自动 git 提交步骤
- 改为输出变更摘要（修改了哪些文件、变更类型），供用户手动提交
- 代码仍然正常编写和修改，只是不自动提交到 git
- 适用场景：用户希望手动控制提交粒度、需要审查后再提交、或使用外部工具管理提交

**注意：** `auto_commit` 仅控制代码的自动提交（execute-plan 中的 `<task_commit>` 协议）。规划文档的提交由 `commit_docs` 单独控制。

</auto_commit_behavior>

<search_behavior>

**当 `search_gitignored: false` (默认) 时：**
- 标准的 rg 行为（遵循 .gitignore）
- 直接路径搜索有效：`rg "pattern" .planning/` 能找到文件
- 广泛搜索会跳过 gitignored 的内容：`rg "pattern"` 会跳过 `.planning/`

**当 `search_gitignored: true` 时：**
- 为应该包含 `.planning/` 的广泛 rg 搜索添加 `--no-ignore` 标志
- 仅在搜索整个代码库并期望获得 `.planning/` 匹配结果时才需要

**注意：** 大多数 GSD 操作使用直接文件读取或显式路径，无论 gitignore 状态如何，这些操作都能正常工作。

</search_behavior>

<setup_uncommitted_mode>

要使用未提交模式 (uncommitted mode)：

1. **设置配置：**
   ```json
   "planning": {
     "commit_docs": false,
     "search_gitignored": true
   }
   ```

2. **添加到 .gitignore：**
   ```
   .planning/
   ```

3. **处理现有的已跟踪文件：** 如果之前跟踪过 `.planning/`：
   ```bash
   git rm -r --cached .planning/
   git commit -m "chore: stop tracking planning docs"
   ```

4. **分支合并：** 当使用 `phase` 或 `milestone` 分支策略时，如果 `commit_docs: false`，`complete-milestone` 工作流在合并提交之前会自动从暂存区移除 `.planning/` 文件。

</setup_uncommitted_mode>

<branching_strategy_behavior>

**分支策略：**

| 策略 | 分支创建时机 | 分支范围 | 合并点 |
|----------|---------------------|--------------|-------------|
| `none` | 从不 | 不适用 | 不适用 |
| `phase` | 在 `execute-phase` 开始时 | 单个阶段 | 阶段完成后由用户合并 |
| `milestone` | 在里程碑的第一个 `execute-phase` 时 | 整个里程碑 | 在 `complete-milestone` 时 |

**当 `git.branching_strategy: "none"` (默认) 时：**
- 所有工作都提交到当前分支
- 标准 GSD 行为

**当 `git.branching_strategy: "phase"` 时：**
- `execute-phase` 在执行前创建/切换到新分支
- 分支名称来自 `phase_branch_template`（例如，`gsd/phase-03-authentication`）
- 所有计划的提交都进入该分支
- 阶段完成后，用户手动合并分支
- `complete-milestone` 会提议合并所有阶段分支

**当 `git.branching_strategy: "milestone"` 时：**
- 里程碑的第一个 `execute-phase` 创建里程碑分支
- 分支名称来自 `milestone_branch_template`（例如，`gsd/v1.0-mvp`）
- 里程碑中的所有阶段都提交到同一个分支
- `complete-milestone` 会提议将里程碑分支合并到主分支 (main)

**模板变量：**

| 变量 | 可用于 | 描述 |
|----------|--------------|-------------|
| `{phase}` | phase_branch_template | 补零后的阶段编号（例如，"03"） |
| `{slug}` | 两者 | 小写的、以连字符分隔的名称 |
| `{milestone}` | milestone_branch_template | 里程碑版本（例如，"v1.0"） |

**检查配置：**

使用 `init execute-phase`，它会以 JSON 形式返回所有配置：
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# JSON 输出包括：branching_strategy, phase_branch_template, milestone_branch_template
```

或者使用 `state load` 获取配置值：
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# 从 JSON 中解析 branching_strategy, phase_branch_template, milestone_branch_template
```

**创建分支：**

```bash
# 针对阶段策略
if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  PHASE_SLUG=$(echo "$PHASE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$PHASE_BRANCH_TEMPLATE" | sed "s/{phase}/$PADDED_PHASE/g" | sed "s/{slug}/$PHASE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi

# 针对里程碑策略
if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  MILESTONE_SLUG=$(echo "$MILESTONE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed "s/{milestone}/$MILESTONE_VERSION/g" | sed "s/{slug}/$MILESTONE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi
```

**complete-milestone 时的合并选项：**

| 选项 | Git 命令 | 结果 |
|--------|-------------|--------|
| 压缩合并 (推荐) | `git merge --squash` | 每个分支产生一个简洁的提交 |
| 保留历史合并 | `git merge --no-ff` | 保留所有个人提交 |
| 不合并直接删除 | `git branch -D` | 丢弃分支工作 |
| 保留分支 | (无) | 以后手动处理 |

推荐使用压缩合并 (Squash merge) —— 这能保持主分支历史整洁，同时在分支中保留完整的开发历史（直到被删除）。

**使用案例：**

| 策略 | 最佳适用场景 |
|----------|----------|
| `none` | 个人开发、简单项目 |
| `phase` | 针对每个阶段的代码审查、细粒度回滚、团队协作 |
| `milestone` | 发布分支、预发布环境、针对每个版本的 PR |

</branching_strategy_behavior>

</planning_config>