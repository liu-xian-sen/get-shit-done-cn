<purpose>
自动化的审计到修复流水线。运行审计、解析发现项、将每个发现项分类为可自动修复或仅限手动修复，为可修复问题启动 executor agent，每次修复后运行测试，并以原子方式提交，附带发现项 ID 以便追溯。
</purpose>

<available_agent_types>
- gsd-executor — 执行特定的、有范围限制的代码变更
</available_agent_types>

<process>

<step name="parse-arguments">
从用户调用中提取标志：

- `--max N` — 最多修复的发现项数量（默认：**5**）
- `--severity high|medium|all` — 处理的最低严重性（默认：**medium**）
- `--dry-run` — 仅分类发现项，不进行修复（仅显示分类表）
- `--source <audit>` — 运行哪种审计（默认：**audit-uat**）

验证 `--source` 是受支持的审计类型。当前支持：
- `audit-uat`

如果 `--source` 不受支持，停止并报错：
```
错误：不支持的审计来源 "{source}"。支持的来源：audit-uat
```
</step>

<step name="run-audit">
调用来源审计命令并捕获输出。

对于 `audit-uat` 来源：
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init audit-uat 2>/dev/null || echo "{}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

读取现有的 UAT 和验证文件以提取发现项：
- Glob：`.planning/phases/*/*-UAT.md`
- Glob：`.planning/phases/*/*-VERIFICATION.md`

将每个发现项解析为结构化记录：
- **ID** — 顺序标识符（F-01、F-02、…）
- **description** — 问题的简要摘要
- **severity** — high、medium 或 low
- **file_refs** — 发现项中引用的具体文件路径
</step>

<step name="classify-findings">
对每个发现项进行分类：

- **可自动修复** — 明确的代码变更、引用了具体文件、可测试的修复
- **仅限手动** — 需要设计决策、范围模糊、架构变更、需要用户输入
- **跳过** — 严重性低于 `--severity` 阈值

**分类启发式规则**（不确定时归为仅限手动）：

可自动修复信号：
- 引用了具体的文件路径 + 行号
- 描述了缺失的测试或断言
- 缺少导出、错误的导入路径、标识符拼写错误
- 明确的单文件变更，预期行为清晰

仅限手动信号：
- 使用了"考虑"、"评估"、"设计"、"重新思考"等词汇
- 需要新的架构或 API 变更
- 范围模糊或有多种有效方案
- 需要用户输入或设计决策
- 影响多个子系统的横切关注点
- 没有明确修复方案的性能或可扩展性问题

**不确定时，始终归为仅限手动。**
</step>

<step name="present-classification">
显示分类表：

```
## 审计修复分类

| # | 发现项 | 严重性 | 分类 | 原因 |
|---|-------|--------|------|------|
| F-01 | index.ts 中缺少导出 | high | 可自动修复 | 具体文件，修复清晰 |
| F-02 | 支付流程中没有错误处理 | high | 仅限手动 | 需要设计决策 |
| F-03 | 测试存根，0 个断言 | medium | 可自动修复 | 明确的测试缺口 |
```

如果指定了 `--dry-run`，**在此停止并退出**。分类表即为最终输出 — 不继续执行修复。
</step>

<step name="fix-loop">
对每个**可自动修复**的发现项（最多 `--max` 个，按严重性降序排列）：

**a. 启动 executor agent：**
```
Task(
  prompt="修复发现项 {ID}：{description}。文件：{file_refs}。做出最小变更以解决此具体发现项。不要重构周边代码。",
  subagent_type="gsd-executor"
)
```

**b. 运行测试：**
```bash
npm test 2>&1 | tail -20
```

**c. 如果测试通过** — 原子提交：
```bash
git add {changed_files}
git commit -m "fix({scope}): resolve {ID} — {description}"
```
提交信息**必须**包含发现项 ID（如 F-01）以便追溯。

**d. 如果测试失败** — 还原变更，将发现项标记为 `fix-failed`，并**停止流水线**：
```bash
git checkout -- {changed_files} 2>/dev/null
```
记录失败原因并停止处理 — 不继续处理下一个发现项。
测试失败表明代码库可能处于意外状态，因此流水线必须停止以避免级联问题。剩余的可自动修复发现项将在报告中显示为 `not-attempted`（未尝试）。
</step>

<step name="report">
呈现最终摘要：

```
## 审计修复完成

**来源：** {audit_command}
**发现项：** {total} 个，{auto} 个可自动修复，{manual} 个仅限手动
**已修复：** {fixed_count}/{auto} 个可自动修复发现项
**失败：** {failed_count} 个（已还原）

| # | 发现项 | 状态 | 提交 |
|---|-------|------|------|
| F-01 | 缺少导出 | 已修复 | abc1234 |
| F-03 | 测试存根 | 修复失败 | （已还原）|

### 仅限手动的发现项（需要开发者关注）：
- F-02：支付流程中没有错误处理 — 需要设计决策
```
</step>

</process>

<success_criteria>
- 可自动修复的发现项按顺序处理，直到达到 --max 上限或测试失败停止流水线
- 每次提交修复后测试通过（无损坏提交）
- 失败的修复被干净还原（不留下部分变更）
- 首次测试失败后流水线停止（无级联修复）
- 每个提交信息都包含发现项 ID
- 仅限手动的发现项被呈现给开发者关注
- --dry-run 产生有用的独立分类表
</success_criteria>
