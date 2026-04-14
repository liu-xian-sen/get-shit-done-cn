# 里程碑摘要工作流

从已完成里程碑的产出物中生成全面的、人类可读的项目摘要。
专为团队新成员引导设计 — 新贡献者阅读输出后即可理解整个项目。

---

## 第 1 步：解析版本号

```bash
VERSION="$ARGUMENTS"
```

若 `$ARGUMENTS` 为空：
1. 检查 `.planning/STATE.md` 中的当前里程碑版本
2. 检查 `.planning/milestones/` 中最新的归档版本
3. 若均未找到，检查 `.planning/ROADMAP.md` 是否存在（项目可能处于里程碑进行中状态）
4. 若什么都没找到：报错 "未找到里程碑。请先运行 /gsd-new-project 或 /gsd-new-milestone。"

将 `VERSION` 设置为解析到的版本号（如 "1.0"）。

## 第 2 步：定位产出物

判断里程碑是**已归档**还是**进行中**：

**已归档里程碑**（`.planning/milestones/v{VERSION}-ROADMAP.md` 存在）：
```
ROADMAP_PATH=".planning/milestones/v${VERSION}-ROADMAP.md"
REQUIREMENTS_PATH=".planning/milestones/v${VERSION}-REQUIREMENTS.md"
AUDIT_PATH=".planning/milestones/v${VERSION}-MILESTONE-AUDIT.md"
```

**进行中里程碑**（尚未归档）：
```
ROADMAP_PATH=".planning/ROADMAP.md"
REQUIREMENTS_PATH=".planning/REQUIREMENTS.md"
AUDIT_PATH=".planning/v${VERSION}-MILESTONE-AUDIT.md"
```

注意：审计文件在归档时会移动到 `.planning/milestones/`（见 `complete-milestone` 工作流）。作为备选，两个位置都要检查。

**始终可用：**
```
PROJECT_PATH=".planning/PROJECT.md"
RETRO_PATH=".planning/RETROSPECTIVE.md"
STATE_PATH=".planning/STATE.md"
```

读取所有存在的文件。文件缺失时没有问题 — 摘要会根据可用内容自适应。

## 第 3 步：发现阶段产出物

查找所有阶段目录：

```bash
gsd-tools.cjs init progress
```

此命令返回阶段元数据。对里程碑范围内的每个阶段：

- 若存在 `{phase_dir}/{padded}-SUMMARY.md`，读取并提取 `one_liner`、`accomplishments`、`decisions`
- 若存在 `{phase_dir}/{padded}-VERIFICATION.md`，读取并提取状态、差距、延期条目
- 若存在 `{phase_dir}/{padded}-CONTEXT.md`，读取并从 `<decisions>` 章节提取关键决策
- 若存在 `{phase_dir}/{padded}-RESEARCH.md`，记录研究内容

追踪每个阶段拥有哪些产出物。

**若不存在阶段目录**（空里程碑或构建前状态）：跳至第 5 步，生成注明"尚未执行任何阶段"的最简摘要。不要报错 — 摘要仍应包含 PROJECT.md 和 ROADMAP.md 的内容。

## 第 4 步：收集 Git 统计信息

按顺序尝试以下方法，直到其中一种成功：

**方法 1 — 带标签的里程碑**（优先检查）：
```bash
git tag -l "v${VERSION}" | head -1
```
若标签存在：
```bash
git log v${VERSION} --oneline | wc -l
git diff --stat $(git log --format=%H --reverse v${VERSION} | head -1)..v${VERSION}
```

**方法 2 — STATE.md 日期范围**（若无标签）：
读取 STATE.md 并提取 `started_at` 或最早的会话日期。将其用作 `--since` 边界：
```bash
git log --oneline --since="<started_at_date>" | wc -l
```

**方法 3 — 最早的阶段提交**（若 STATE.md 无日期）：
查找最早的 `.planning/phases/` 提交：
```bash
git log --oneline --diff-filter=A -- ".planning/phases/" | tail -1
```
使用该提交的日期作为起始边界。

**方法 4 — 跳过统计**（若以上方法均不可用）：
报告 "Git 统计不可用 — 无法确定标签或日期范围。" 这不是错误 — 摘要继续生成，但不包含统计章节。

提取（若可用）：
- 里程碑内的总提交数
- 文件变更数、新增行数、删除行数
- 时间线（开始日期 → 结束日期）
- 贡献者（来自 git log 作者）

## 第 5 步：生成摘要文档

写入 `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md`：

```markdown
# 里程碑 v{VERSION} — 项目摘要

**生成时间：** {date}
**用途：** 团队引导与项目回顾

---

## 1. 项目概览

{来自 PROJECT.md："这是什么"、核心价值主张、目标用户}
{若为里程碑进行中：注明哪些阶段已完成，哪些进行中}

## 2. 架构与技术决策

{来自各阶段 CONTEXT.md 文件：关键技术选择}
{来自 SUMMARY.md 决策：采用的模式、库、框架}
{来自 PROJECT.md：若已记录技术栈}

以带简要说明的列表形式呈现决策：
- **决策：** {选择了什么}
  - **原因：** {来自 CONTEXT.md 的理由}
  - **阶段：** {哪个阶段做出了此决策}

## 3. 已交付阶段

| 阶段 | 名称 | 状态 | 一句话描述 |
|------|------|------|-----------|
{对每个阶段：编号、名称、状态（已完成/进行中/已计划）、来自 SUMMARY.md 的 one_liner}

## 4. 需求覆盖情况

{来自 REQUIREMENTS.md：列出每个需求及状态}
- ✅ {已满足的需求}
- ⚠️ {部分满足的需求 — 注明差距}
- ❌ {未满足的需求 — 注明原因}

{若存在 MILESTONE-AUDIT.md：包含审计结论}

## 5. 关键决策日志

{汇总所有 CONTEXT.md 的 <decisions> 章节}
{每条决策包含：ID、描述、阶段、理由}

## 6. 技术债务与延期条目

{来自 VERIFICATION.md 文件：发现的差距、注意到的反模式}
{来自 RETROSPECTIVE.md：经验教训、待改进事项}
{来自 CONTEXT.md 的 <deferred> 章节：留待后续处理的想法}

## 7. 快速上手

{新贡献者入口：}
- **运行项目：** {来自 PROJECT.md 或 SUMMARY.md}
- **关键目录：** {来自代码库结构}
- **测试：** {来自 PROJECT.md 或 CLAUDE.md 的测试命令}
- **首先查看哪里：** {主要入口、核心模块}

---

## 统计

- **时间线：** {start} → {end}（{duration}）
- **阶段：** {完成数} / {总数}
- **提交数：** {count}
- **文件变更：** {count}（+{insertions} / -{deletions}）
- **贡献者：** {list}
```

## 第 6 步：写入并提交

**覆盖保护：** 若 `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md` 已存在，询问用户：
> "v{VERSION} 的里程碑摘要已存在。是覆盖还是查看现有内容？"
若选择"查看"：显示现有文件并跳至第 8 步（交互模式）。若选择"覆盖"：继续执行。

若需要，创建 reports 目录：
```bash
mkdir -p .planning/reports
```

写入摘要，然后提交：
```bash
gsd-tools.cjs commit "docs(v${VERSION}): generate milestone summary for onboarding" \
  --files ".planning/reports/MILESTONE_SUMMARY-v${VERSION}.md"
```

## 第 7 步：呈现摘要

内联显示完整摘要文档。

## 第 8 步：提供交互模式

呈现摘要后：

> "摘要已写入 `.planning/reports/MILESTONE_SUMMARY-v{VERSION}.md`。
>
> 我已加载构建产出物的完整上下文。想了解项目的任何方面吗？
> 架构决策、具体阶段、需求、技术债务 — 随时提问。"

若用户提问：
- 根据已加载的产出物（CONTEXT.md、SUMMARY.md、VERIFICATION.md 等）作答
- 引用具体文件和决策
- 严格基于实际构建内容（不做推测）

若用户完成：
- 建议后续步骤：`/gsd-new-milestone`、`/gsd-progress`，或将摘要分享给团队

## 第 9 步：更新 STATE.md

```bash
gsd-tools.cjs state record-session \
  --stopped-at "Milestone v${VERSION} summary generated" \
  --resume-file ".planning/reports/MILESTONE_SUMMARY-v${VERSION}.md"
```
