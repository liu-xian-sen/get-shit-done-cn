<purpose>
对所有开放的 GitHub Issues 和 PR 进行分类审查，检查其是否符合项目贡献模板。
生成结构化报告，展示每个条目的合规状态，标记缺失的必填字段，识别标签缺口，并可选择采取行动（打标签、评论、关闭）。
</purpose>

<required_reading>
开始前，请阅读以下项目文件以了解审查标准：
- `.github/ISSUE_TEMPLATE/feature_request.yml` — 功能类 issue 的必填字段
- `.github/ISSUE_TEMPLATE/enhancement.yml` — 改进类 issue 的必填字段
- `.github/ISSUE_TEMPLATE/chore.yml` — 维护类 issue 的必填字段
- `.github/ISSUE_TEMPLATE/bug_report.yml` — 缺陷报告的必填字段
- `.github/PULL_REQUEST_TEMPLATE/feature.md` — 功能类 PR 的必填检查清单
- `.github/PULL_REQUEST_TEMPLATE/enhancement.md` — 改进类 PR 的必填检查清单
- `.github/PULL_REQUEST_TEMPLATE/fix.md` — 修复类 PR 的必填检查清单
- `CONTRIBUTING.md` — issue 优先规则与审批门禁
</required_reading>

<process>

<step name="preflight">
验证前置条件：

1. **`gh` CLI 是否可用且已通过身份验证？**
   ```bash
   which gh && gh auth status 2>&1
   ```
   若不可用：打印安装说明并退出。

2. **检测仓库：**
   若提供了 `--repo` 参数，则使用该值。否则：
   ```bash
   gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null
   ```
   若未检测到仓库：报错 — 必须在包含 GitHub 远程的 git 仓库中运行。

3. **解析参数：**
   - `--issues` → 设置 REVIEW_ISSUES=true, REVIEW_PRS=false
   - `--prs` → 设置 REVIEW_ISSUES=false, REVIEW_PRS=true
   - `--label` → 设置 AUTO_LABEL=true
   - `--close-incomplete` → 设置 AUTO_CLOSE=true
   - 默认（无参数）：同时审查 issues 和 PR，仅生成报告（不执行自动操作）
</step>

<step name="fetch_issues">
若 REVIEW_ISSUES=false，则跳过此步骤。

获取所有开放 issues：
```bash
gh issue list --state open --json number,title,labels,body,author,createdAt,updatedAt --limit 100
```

对每个 issue，根据标签和正文内容分类：

| 标签/特征 | 类型 | 模板 |
|---|---|---|
| `feature-request` | 功能 | feature_request.yml |
| `enhancement` | 改进 | enhancement.yml |
| `bug` | 缺陷 | bug_report.yml |
| `type: chore` | 维护 | chore.yml |
| 无匹配标签 | 未知 | 标记为待人工分类 |

若 issue 无类型标签，尝试从正文内容分类：
- 包含 "### Feature name" → 可能是功能类
- 包含 "### What existing feature" → 可能是改进类
- 包含 "### What happened?" → 可能是缺陷类
- 包含 "### What is the maintenance task?" → 可能是维护类
- 无法确定 → 标记为 `needs-triage`
</step>

<step name="review_issues">
若 REVIEW_ISSUES=false，则跳过此步骤。

对每个已分类的 issue，根据其模板要求进行审查。

**功能请求审查清单：**
- [ ] 包含提交前检查清单（4 个复选框）
- [ ] 已填写功能名称
- [ ] 已选择新增类型
- [ ] 问题陈述已填写（非占位符文字）
- [ ] 已描述新增内容及示例
- [ ] 已列出完整变更范围（创建/修改的文件/系统）
- [ ] 包含用户故事（至少 2 个）
- [ ] 包含验收标准（可测试的条件）
- [ ] 已选择适用的运行时
- [ ] 包含破坏性变更评估
- [ ] 已描述维护负担
- [ ] 已考虑替代方案（非空）
- **标签检查：** 是否有 `needs-review` 标签？是否有 `approved-feature` 标签？
- **门禁检查：** 若存在关联此 issue 的 PR，该 issue 是否有 `approved-feature`？

**改进类审查清单：**
- [ ] 包含提交前检查清单（4 个复选框）
- [ ] 已标识改进内容
- [ ] 已描述当前行为及示例
- [ ] 已描述预期行为及示例
- [ ] 已阐明原因和收益（非模糊描述）
- [ ] 已列出变更范围
- [ ] 已评估破坏性变更
- [ ] 已考虑替代方案
- [ ] 已选择受影响区域
- **标签检查：** 是否有 `needs-review` 标签？是否有 `approved-enhancement` 标签？
- **门禁检查：** 若存在关联此 issue 的 PR，该 issue 是否有 `approved-enhancement`？

**缺陷报告审查清单：**
- [ ] 已提供 GSD 版本
- [ ] 已选择运行时
- [ ] 已选择操作系统
- [ ] 已提供 Node.js 版本
- [ ] 已描述发生了什么
- [ ] 已描述预期行为
- [ ] 已提供复现步骤
- [ ] 已选择出现频率
- [ ] 已选择严重程度/影响
- [ ] 已确认隐私数据检查清单
- **标签检查：** 是否有 `needs-triage` 或 `confirmed-bug` 标签？

**维护类审查清单：**
- [ ] 已确认提交前检查清单（无面向用户的变更）
- [ ] 已描述维护任务
- [ ] 已选择维护类型
- [ ] 已具体描述当前状态
- [ ] 已列出拟议工作
- [ ] 包含验收标准
- [ ] 已选择受影响区域
- **标签检查：** 是否有 `needs-triage` 标签？

**评分：** 对每个 issue，计算完整度百分比：
- 统计已填写的必填字段数 vs 总必填字段数
- 得分 = (已填写 / 总数) * 100
- 状态：完整 (100%)、基本完整 (75-99%)、不完整 (50-74%)、拒绝 (<50%)
</step>

<step name="fetch_prs">
若 REVIEW_PRS=false，则跳过此步骤。

获取所有开放 PR：
```bash
gh pr list --state open --json number,title,labels,body,author,headRefName,baseRefName,isDraft,createdAt,reviewDecision,statusCheckRollup --limit 100
```

对每个 PR，根据正文内容和关联 issue 分类：

| 正文特征 | 类型 | 模板 |
|---|---|---|
| 包含 "## Feature PR" 或 "## Feature summary" | 功能 PR | feature.md |
| 包含 "## Enhancement PR" 或 "## What this enhancement improves" | 改进 PR | enhancement.md |
| 包含 "## Fix PR" 或 "## What was broken" | 修复 PR | fix.md |
| 使用默认模板 | 错误模板 | 标记 — 必须使用类型化模板 |
| 无法确定 | 未知 | 标记为待人工审查 |

同时检查关联 issues：
```bash
gh pr view {number} --json body -q '.body' | grep -oE '(Closes|Fixes|Resolves) #[0-9]+'
```
</step>

<step name="review_prs">
若 REVIEW_PRS=false，则跳过此步骤。

对每个已分类的 PR，根据其模板要求进行审查。

**功能 PR 审查清单：**
- [ ] 使用功能 PR 模板（非默认模板）
- [ ] 通过 `Closes #NNN` 关联 issue
- [ ] 关联 issue 存在且有 `approved-feature` 标签
- [ ] 包含功能摘要
- [ ] 已填写新增文件表格
- [ ] 已填写修改文件表格
- [ ] 包含实现说明
- [ ] 包含规范合规检查清单（来自 issue 的验收标准）
- [ ] 已描述测试覆盖情况
- [ ] 已勾选测试平台（macOS、Windows、Linux）
- [ ] 已勾选测试运行时
- [ ] 已确认范围
- [ ] 已完成完整检查清单
- [ ] 已填写破坏性变更章节
- **CI 检查：** 所有状态检查是否通过？
- **审查检查：** 是否已获得审查批准？

**改进 PR 审查清单：**
- [ ] 使用改进 PR 模板（非默认模板）
- [ ] 通过 `Closes #NNN` 关联 issue
- [ ] 关联 issue 存在且有 `approved-enhancement` 标签
- [ ] 已描述改进内容
- [ ] 已提供前后对比
- [ ] 已描述实现方案
- [ ] 已描述验证方法
- [ ] 已勾选测试平台
- [ ] 已勾选测试运行时
- [ ] 已确认范围
- [ ] 已完成完整检查清单
- [ ] 已填写破坏性变更章节
- **CI 检查：** 所有状态检查是否通过？

**修复 PR 审查清单：**
- [ ] 使用修复 PR 模板（非默认模板）
- [ ] 通过 `Fixes #NNN` 关联 issue
- [ ] 关联 issue 存在且有 `confirmed-bug` 标签
- [ ] 已描述损坏内容
- [ ] 已描述修复内容
- [ ] 已解释根本原因
- [ ] 已描述验证方法
- [ ] 已添加回归测试（或说明未添加原因）
- [ ] 已勾选测试平台
- [ ] 已勾选测试运行时
- [ ] 已完成完整检查清单
- [ ] 已填写破坏性变更章节
- **CI 检查：** 所有状态检查是否通过？

**所有类型 PR 的通用检查：**
- [ ] PR 标题具有描述性（非仅 "fix" 或 "update"）
- [ ] 每个 PR 只关注一个问题（不混合修复和改进）
- [ ] diff 中无无关格式变更
- [ ] CHANGELOG.md 已更新
- [ ] 未使用 `--no-verify` 或跳过钩子

**评分：** 与 issues 相同 — 每个 PR 的完整度百分比。
</step>

<step name="check_gates">
交叉对比 issues 和 PR，强制执行 issue 优先规则：

对每个开放 PR：
1. 从正文中提取关联 issue 编号
2. 若无关联 issue：**门禁违规** — PR 未关联 issue
3. 若关联 issue 存在，检查其标签：
   - 功能 PR → issue 必须有 `approved-feature`
   - 改进 PR → issue 必须有 `approved-enhancement`
   - 修复 PR → issue 必须有 `confirmed-bug`
4. 若标签缺失：**门禁违规** — PR 在审批前已提交

门禁违规是最重要的发现，请在报告中突出显示 — 项目会自动关闭不满足审批门禁的 PR。
</step>

<step name="generate_report">
生成结构化的分类报告：

```
===================================================================
  GSD INBOX TRIAGE — {repo} — {date}
===================================================================

摘要
-------
开放 issues: {count}    开放 PR: {count}
  功能类:    {n}        功能 PR:      {n}
  改进类:    {n}        改进 PR:      {n}
  缺陷类:   {n}         修复 PR:      {n}
  维护类:   {n}         错误模板:     {n}
  未分类:   {n}         无关联 issue: {n}

门禁违规（需立即处理）
---------------------------------
{对每个违规:}
  PR #{number}: {title}
    问题: {描述 — 如 "关联 issue #45 缺少 approved-feature 标签"}
    处理: {应做什么 — 如 "关闭 PR 或先审批 issue #45"}

需要处理的 Issues
------------------------
{按完整度得分升序排列:}
  #{number} [{type}] {title}
    得分: {percentage}% 完整
    缺失: {缺失必填字段列表}
    标签: {当前标签} → 建议: {推荐标签}
    时长: {创建至今天数}

需要处理的 PR
---------------------
{按完整度得分升序排列:}
  #{number} [{type}] {title}
    得分: {percentage}% 完整
    缺失: {缺失检查项列表}
    CI: {通过/失败/待定}
    审查: {已批准/需修改/无}
    关联 issue: #{issue_number} ({issue_status})
    时长: {创建至今天数}

可合并
--------------
{100% 完整、CI 通过、已批准的 PR:}
  #{number} {title} — 可合并

过期条目（30 天以上无活动）
--------------------------------------------
{30 天以上无更新的 issues 和 PR}

===================================================================
```

若存在 `.planning/` 目录，将此报告写入 `.planning/INBOX-TRIAGE.md`，否则仅打印到控制台。
</step>

<step name="auto_actions">
仅在设置了 `--label` 或 `--close-incomplete` 参数时执行。

**若设置了 --label：**
对每个标签缺失或不正确的 issue/PR：
```bash
gh issue edit {number} --add-label "{label}"
```
或：
```bash
gh pr edit {number} --add-label "{label}"
```

标签建议：
- 未分类 issues → 添加 `needs-triage`
- 未审查的功能 issues → 添加 `needs-review`
- 未审查的改进 issues → 添加 `needs-review`
- 未分类的缺陷报告 → 添加 `needs-triage`
- 门禁违规的 PR → 添加 `gate-violation`

**若设置了 --close-incomplete：**
对完整度低于 50% 的 issues：
```bash
gh issue close {number} --comment "由 GSD inbox triage 关闭：此 issue 缺少 issue 模板要求的必填字段。缺失：{list}。请重新提交完整内容。详见 CONTRIBUTING.md。"
```

对门禁违规的 PR：
```bash
gh pr close {number} --comment "由 GSD inbox triage 关闭：此 PR 不符合 issue 优先要求。{specific violation}。详见 CONTRIBUTING.md 中的正确流程。"
```

关闭任何内容前，务必向用户确认：

**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 参数）：** 若 `$ARGUMENTS` 中包含 `--text` 或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。TEXT_MODE 激活时，将所有 `AskUserQuestion` 调用替换为纯文本编号列表，要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需设置，因为这些运行时不支持 `AskUserQuestion`。

```
AskUserQuestion:
  question: "找到 {N} 个待关闭条目。请查看上方列表 — 确认关闭？"
  options:
    - label: "全部关闭"
      description: "关闭所有 {N} 个不合规条目并添加说明评论"
    - label: "逐一选择"
      description: "我来选择要关闭哪些"
    - label: "跳过"
      description: "不关闭任何内容 — 仅生成报告"
```
</step>

<step name="report">
```
───────────────────────────────────────────────────────────────

## 收件箱分类完成

已审查：{issue_count} 个 issues，{pr_count} 个 PR
门禁违规：{violation_count}
可合并：{ready_count}
需处理：{attention_count}
过期（30 天以上）：{stale_count}
{若报告已保存: "报告已保存至 .planning/INBOX-TRIAGE.md"}

后续步骤：
- 优先处理门禁违规 — 这些问题会阻塞贡献流程
- 处理不完整提交（评论或关闭）
- 合并可合并的 PR
- 对未分类 issues 进行分类

───────────────────────────────────────────────────────────────
```
</step>

</process>

<offer_next>
分类完成后：

- /gsd-review — 对特定阶段计划进行跨 AI 同行评审
- /gsd-ship — 从已完成的工作创建 PR
- /gsd-progress — 查看项目整体状态
- /gsd-inbox --label — 重新运行并启用自动打标签
</offer_next>

<success_criteria>
- [ ] 所有开放 issues 已获取并按类型分类
- [ ] 每个 issue 已根据其模板要求审查
- [ ] 所有开放 PR 已获取并按类型分类
- [ ] 每个 PR 已根据其模板检查清单审查
- [ ] issue 优先门禁违规已识别
- [ ] 已生成包含得分和行动项的结构化报告
- [ ] 仅在设置参数且用户确认后执行自动操作
</success_criteria>
