---
component: verifier
version: 2
last_calibrated: 2026-03-25
calibration_source: "Adapted from thinking-partner verification corpus"
---

# Verifier 少样本示例

## 正面示例

### 示例 1：全面的多层级制品验证，发现真实差距

**输入：** 必须有的制品：`get-shit-done/workflows/context-bridge.md: >50 行`

**输出：**

> **L1（存在性）：** 存在 —— 找到 `get-shit-done/workflows/context-bridge.md`，共 187 行。
> **L2（实质性）：** 实质性 —— 无 TODO/FIXME 标记，4 个已定义的章节（`updateContextTier`、`getContextBudget`、`injectContextWarning`、`resetTierState`），包含非平凡逻辑、配置读取和阈值计算。
> **L3（已接线）：** 已接线 —— 在 `get-shit-done/workflows/execute-phase.md` 第 3 步中被引用。通过 @ 引用包含被 `agents/gsd-executor.md` 调用。参数已验证：接收的规划目录路径与预期参数匹配。
> **状态：通过**

**为何这是好示例：** 验证器在每个层级都用具体证据独立检查——文件路径、行数、导出符号、导入位置和参数验证。它不止步于"文件存在"，而是追踪了接线直至使用正确参数的实际调用。

### 示例 2：正确的 FAILED 分类，含 grep 证据

**输入：** 必须有的事实：`validate-commit.js 拒绝缺少作用域括号的提交`

**输出：**

> **方法：** 运行 `grep -n "scope" get-shit-done/bin/validate-commit.js` 以定位作用域验证逻辑。
> **证据：** 第 34-41 行显示正则表达式 `/^(feat|fix|refactor|test|docs|chore|wip)\(/`，要求类型后面有左括号。但是，不存在对缺少右括号的测试——正则表达式接受 `feat(: description`（缺少作用域内容和右括号）。
> **运行：** `echo "feat(: test" | node get-shit-done/bin/validate-commit.js` —— 退出码为 0（被接受）。
> **状态：失败** —— 带有空作用域 `feat(: desc)` 的提交消息被接受。"拒绝缺少作用域括号的提交"这一事实对于空作用域边界情况不成立。

**为何这是好示例：** 验证器没有信任代码的意图——它用边界情况输入运行了实际测试，并报告了具体的失败。证据包括正则表达式、测试命令、退出码，以及事实不成立的原因。

### 示例 3：发现缺失的接线（校准派生的差距模式）

**输入：** 必须有的关键链接：`check-subagent-output.js 导入并调用 feedback-loop.js 的 extractFeedback()`

**输出：**

> **方法：** 运行 `grep -n "feedback-loop\|extractFeedback" get-shit-done/bin/check-subagent-output.js`。
> **证据：** 零匹配。文件 `feedback-loop.js` 存在（172 行，有实质内容），`tests/feedback-loop.test.js` 通过（229 行）。但 `check-subagent-output.js` 从未导入或调用它。
> **交叉验证：** `grep -rn "require.*feedback-loop" get-shit-done/bin/` 在所有脚本中返回零结果。
> **状态：失败** —— 制品存在且已测试，但完全孤立。"导入并调用"这一关键链接不成立。这是一个**缺失接线**的差距。

**为何这是好示例：** 验证器捕获了一种常见的校准模式：代码存在、已经过测试，但从未实际接入系统。L1 和 L2 通过，但 L3（接线）失败。该模式占校准语料库中所有差距的 37%。

### 示例 4：发现缺失的配置 schema 条目（校准派生的差距模式）

**输入：** 必须有的事实：`Config 中的 features.architecture_graph 和 features.architecture_guard 切换开关存在且有默认值`

**输出：**

> **方法：** 运行 `grep "architecture_graph\|architecture_guard" get-shit-done/bin/lib/config-schema.json`。
> **证据：** schema 中零匹配。但 `grep "architecture" get-shit-done/bin/lib/config.cjs` 显示两个标志存在于 CONFIG_DEFAULTS 中（第 426、428 行）。
> **差距：** 默认值存在于代码中，但 schema 验证不知道它们。`configValidate()` 在加载时会剥离这些字段，使默认值无法访问。
> **状态：失败** —— Config 标志在代码中有效，但对 schema 验证不可见。这是 config 层之间**缺失接线**的差距。

**为何这是好示例：** 验证器检查了多个 config 层（schema vs 默认值 vs 代码），而不是只检查一层。Config 接线需要 schema + 默认值 + 代码三者一致——只检查一层会遗漏层间不匹配的 bug。

### 示例 5：区分规划差距与执行失败

**输入：** 必须有的事实：`所有 MSYS 正则模式已整合到共享模块中`

**输出：**

> **方法：** 运行 `grep -rn "\/\[a-zA-Z\]\/" get-shit-done/bin/` 查找内联 MSYS 正则。
> **证据：** `commands/gsd/misc.md` 中有 2 处匹配（第 26、487 行）。这些**不在**原始计划范围内——Phase 148 在 Phase 149 的计划编写之后才将代码提取到 misc.md 中。
> **评估：** 执行器正确完成了所有已计划的任务。差距是**规划排序问题**，而非执行失败。
> **状态：带注释通过** —— 执行器完成了计划的内容。未整合的正则记录为后续跟进项，而非本阶段的失败。

**为何这是好示例：** 验证器区分了已计划内容与当前实际情况。在计划创建后发生的代码变更是规划差距，而非执行器失败。这防止了对正确执行的工作产生误判的 FAIL 结论。

## 校准派生的差距模式

基于对验证语料库的分析（通过率 80%，8 个差距）：

| 模式 | 数量 | 占差距百分比 | 检查内容 |
|---------|-------|-----------|---------------|
| 缺失接线 | 3 | 37% | 文件存在且已测试，但从未被消费者导入/调用 |
| 缺失测试 | 2 | 25% | 功能正常但测试文件被排除在 CI 外或从未运行 |
| 其他 | 3 | 38% | Config 层不匹配、规划排序问题、schema 差距 |

## 负面示例

### 示例 1：无逐条目证据的统一通过

**输入：** 必须有的内容：来自计划 frontmatter 的 5 个事实、3 个制品、2 个关键链接。

**输出：**

> 所有必须有的内容均已验证。实现与计划要求匹配。文件存在且已正确连接。状态：通过。
> must_haves_checked: 10，must_haves_passed: 10

**为何这是坏示例：** 没有列出或检查任何单独的必须有项。没有文件路径、没有行号、没有 grep 输出、没有逐层分解。验证器重述了必须有项并声称通过，却没有提供任何证据。这将遗漏存根、孤立的导出和损坏的接线。

### 示例 2：文件存在性检查未做实质性或接线验证

**输入：** 必须有的制品：`get-shit-done/bin/lib/audit-checks/index.cjs: >100 行`

**输出：**

> **L1（存在性）：** 存在 —— 在 `get-shit-done/bin/lib/audit-checks/index.cjs` 找到文件，共 142 行。
> **状态：通过**

**为何这是坏示例：** 验证器在第 1 层就停止了。文件有 142 行，但内容可能是 `// TODO: 实现所有检查`，加上返回空对象的存根函数。第 2 层（实质性）和第 3 层（已接线）被完全跳过。存在但从未被导入或只包含占位符代码的文件不应通过。
