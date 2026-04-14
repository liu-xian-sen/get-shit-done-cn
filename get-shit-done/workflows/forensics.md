# 取证工作流

针对失败或卡住的 GSD 工作流进行事后调查。分析 git 历史、
`.planning/` 制品和文件系统状态，以检测异常并生成
结构化的诊断报告。

**原则：** 这是只读调查。不要修改项目文件。
只写取证报告。

---

## 步骤 1：获取问题描述

```bash
PROBLEM="$ARGUMENTS"
```

如果 `$ARGUMENTS` 为空，询问用户：
> "出了什么问题？请描述问题——例如，'自主模式在阶段 3 卡住了'，
> 'execute-phase 静默失败'，'费用似乎异常高'。"

记录问题描述以备报告使用。

## 步骤 2：收集证据

从所有可用来源收集数据。缺少某些来源没关系——适应现有内容。

### 2a. Git 历史

```bash
# 最近的提交（最后 30 条）
git log --oneline -30

# 带时间戳的提交，用于间隔分析
git log --format="%H %ai %s" -30

# 最近提交中更改的文件（检测重复编辑）
git log --name-only --format="" -20 | sort | uniq -c | sort -rn | head -20

# 未提交的工作
git status --short
git diff --stat
```

记录：
- 提交时间线（日期、消息、频率）
- 编辑最多的文件（潜在的卡住循环指标）
- 未提交的更改（潜在的崩溃/中断指标）

### 2b. 规划状态

如果存在，读取这些文件：
- `.planning/STATE.md` — 当前里程碑、阶段、进度、阻塞点、最后会话
- `.planning/ROADMAP.md` — 带状态的阶段列表
- `.planning/config.json` — 工作流配置

提取：
- 当前阶段及其状态
- 最后记录的会话停止点
- 任何阻塞点或标志

### 2c. 阶段制品

对于 `.planning/phases/*/` 中的每个阶段目录：

```bash
ls .planning/phases/*/
```

对于每个阶段，检查哪些制品存在：
- `{padded}-PLAN.md` 或 `{padded}-PLAN-*.md`（执行计划）
- `{padded}-SUMMARY.md`（完成摘要）
- `{padded}-VERIFICATION.md`（质量验证）
- `{padded}-CONTEXT.md`（设计决策）
- `{padded}-RESEARCH.md`（规划前研究）

跟踪：哪些阶段有完整的制品集，哪些有缺口。

### 2d. 会话报告

如果 `.planning/reports/SESSION_REPORT.md` 存在，读取它——提取最后会话结果、
已完成的工作、token 估算。

### 2e. Git 工作树状态

```bash
git worktree list
```

检查孤立的工作树（来自崩溃的 Agent）。

## 步骤 3：检测异常

根据这些异常模式评估收集到的证据：

### 卡住循环检测

**信号：** 同一个文件在短时间窗口内的 3+ 个连续提交中出现。

```bash
# 查找在序列中重复提交的文件
git log --name-only --format="---COMMIT---" -20
```

解析提交边界。如果任何文件出现在 3+ 个连续提交中，标记为：
- **置信度高** 如果提交消息相似（例如在同一文件上重复出现 "fix:"、"fix:"、"fix:"）
- **置信度中** 如果文件频繁出现但提交消息各异

### 缺失制品检测

**信号：** 阶段看起来已完成（有提交，在路线图中已过去）但缺少预期制品。

对于每个应该完成的阶段：
- PLAN.md 缺失 → 规划步骤被跳过
- SUMMARY.md 缺失 → 阶段未正确关闭
- VERIFICATION.md 缺失 → 质量检查被跳过

### 放弃工作检测

**信号：** 最后一次提交和当前时间之间有较大间隔，而 STATE.md 显示正在执行中。

```bash
# 自最后提交以来的时间
git log -1 --format="%ai"
```

如果 STATE.md 显示活动阶段，但最后一次提交超过 2 小时前，且有
未提交的更改，标记为潜在的放弃或崩溃。

### 崩溃/中断检测

**信号：** 未提交的更改 + STATE.md 显示执行中 + 孤立的工作树。

综合：
- `git status` 显示已修改/已暂存的文件
- STATE.md 有活动的执行条目
- `git worktree list` 显示除主工作树之外的工作树

### 范围漂移检测

**信号：** 最近的提交触及当前阶段预期范围之外的文件。

读取当前阶段 PLAN.md 以确定预期的文件路径。与最近提交中实际修改的
文件进行比较。标记明显超出阶段领域的文件。

### 测试回退检测

**信号：** 提交消息包含 "fix test"、"revert" 或测试文件的重新提交。

```bash
git log --oneline -20 | grep -iE "fix test|revert|broken|regression|fail"
```

## 步骤 4：生成报告

如果需要，创建取证目录：
```bash
mkdir -p .planning/forensics
```

写入 `.planning/forensics/report-$(date +%Y%m%d-%H%M%S).md`：

```markdown
# 取证报告

**生成时间：** {ISO 时间戳}
**问题：** {用户描述}

---

## 证据摘要

### Git 活动
- **最后提交：** {date} — "{message}"
- **提交（最后 30 条）：** {count}
- **时间跨度：** {earliest} → {latest}
- **未提交的更改：** {是/否——如果是则列出}
- **活动工作树：** {count——如果 >1 则列出}

### 规划状态
- **当前里程碑：** {version 或 "无"}
- **当前阶段：** {number — name — status}
- **最后会话：** {来自 STATE.md 的 stopped_at}
- **阻塞点：** {来自 STATE.md 的任何标志}

### 制品完整性
| 阶段 | PLAN | CONTEXT | RESEARCH | SUMMARY | VERIFICATION |
|------|------|---------|----------|---------|-------------|
{每个阶段：name | 每个制品的 ✅/❌}

## 检测到的异常

### {异常类型} — {置信度：高/中/低}
**证据：** {具体的提交、文件或状态数据}
**解读：** {这可能意味着什么}

{对每个发现的异常重复}

## 根本原因假设

基于上述证据，最可能的解释是：

{基于异常的 1-3 句假设}

## 建议的操作

1. {具体的、可操作的修复步骤}
2. {如果适用，另一个步骤}
3. {如果适用，恢复命令——例如 `/gsd-resume-work`、`/gsd-execute-phase N`}

---

*报告由 `/gsd-forensics` 生成。所有路径已简化以提高可移植性。*
```

**简化规则：**
- 用相对路径替换绝对路径（去除 `$HOME` 前缀）
- 删除在 git diff 输出中找到的任何 API 密钥、令牌或凭据
- 将大型 diff 截断为前 50 行

## 步骤 5：呈现报告

内联显示完整的取证报告。

## 步骤 6：提供交互式调查

> "报告已保存到 `.planning/forensics/report-{timestamp}.md`。
>
> 我可以深入调查任何发现。您希望我：
> - 追溯某个特定异常的根本原因？
> - 读取证据中引用的特定文件？
> - 检查是否曾报告过类似问题？"

如果用户提出后续问题，从已收集的证据中回答。
仅在特别需要时读取其他文件。

## 步骤 7：提供创建问题

如果发现了可操作的异常（高或中置信度）：

> "要我为此创建一个 GitHub Issue 吗？我会格式化发现并简化路径。"

如果确认：
```bash
# 在使用 "bug" 标签之前检查它是否存在
BUG_LABEL=$(gh label list --search "bug" --json name -q '.[0].name' 2>/dev/null)
LABEL_FLAG=""
if [ -n "$BUG_LABEL" ]; then
  LABEL_FLAG="--label bug"
fi

gh issue create \
  --title "bug: {来自异常的简洁描述}" \
  $LABEL_FLAG \
  --body "{来自报告的格式化发现}"
```

## 步骤 8：更新 STATE.md

```bash
gsd-tools.cjs state record-session \
  --stopped-at "取证调查完成" \
  --resume-file ".planning/forensics/report-{timestamp}.md"
```
