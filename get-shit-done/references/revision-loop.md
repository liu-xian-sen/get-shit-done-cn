# 修订循环模式

带反馈的迭代 agent 修订标准模式。当检查器/验证器发现问题且生产 agent 需要修订其输出时使用。

---

## 模式：检查-修订-升级（最多 3 次迭代）

以下情况适用此模式：
1. Agent 产生输出（计划、导入、差距闭合计划）
2. 检查器/验证器评估该输出
3. 发现需要修订的问题

### 流程

```
prev_issue_count = Infinity
iteration = 0

循环：
  1. 对当前输出运行检查器/验证器
  2. 读取检查器结果
  3. 如果 PASSED 或只有 INFO 级别的问题：
     -> 接受输出，退出循环
  4. 如果发现 BLOCKER 或 WARNING 问题：
     a. iteration += 1
     b. 如果 iteration > 3：
        -> 升级给用户（见"3 次迭代后"）
     c. 从检查器输出解析问题数量
     d. 如果 issue_count >= prev_issue_count：
        -> 升级给用户："修订循环停滞（问题数量未减少）"
     e. prev_issue_count = issue_count
     f. 重新生成生产 agent 并附上检查器反馈
     g. 修订完成后，返回循环
```

### 问题数量追踪

追踪检查器在每次迭代中返回的 BLOCKER + WARNING 问题数量。如果连续迭代之间数量没有减少，则生产 agent 陷入困境，进一步迭代无济于事。提前中断并升级给用户。

在每次修订生成前显示迭代进度：
`修订迭代 {N}/3 —— {blocker_count} 个阻塞问题，{warning_count} 个警告`

### 重新生成提示结构

为修订重新生成生产 agent 时，传递检查器的 YAML 格式问题。检查器的输出包含 `## Issues` 标题，后跟 YAML 块。解析此块并原样传递给修订 agent。

```
<checker_issues>
以下问题为 YAML 格式。每个问题包含：dimension、severity、finding、
affected_field、suggested_fix。处理所有 BLOCKER 问题。在可行的情况下
处理 WARNING 问题。

{来自检查器输出的 YAML 问题块——原样传递}
</checker_issues>

<revision_instructions>
处理上面识别的所有 BLOCKER 和 WARNING 问题。
- 对于每个 BLOCKER：进行必要的修改
- 对于每个 WARNING：处理或解释为何可以接受
- 修复现有问题时不要引入新问题
- 保留检查器未标记的所有内容
这是最多 3 次中的第 {N} 次修订迭代。上一次迭代有 {prev_count} 个问题。
你必须减少数量，否则循环将终止。
</revision_instructions>
```

### 3 次迭代后

如果 3 次修订循环后问题仍然存在：

1. 向用户展示剩余问题
2. 使用门禁提示（来自 `references/gate-prompts.md` 的模式 yes-no）：
   question: "3 次修订尝试后问题仍然存在。是否继续使用当前输出？"
   header: "Proceed?"
   options:
     - label: "Proceed anyway"   description: "接受带有剩余问题的输出"
     - label: "Adjust approach"  description: "讨论不同的方法"
3. 如果"Proceed anyway"：接受当前输出并继续
4. 如果"Adjust approach"或"其他"：与用户讨论，然后用更新的上下文重新进入生产步骤

### 工作流特定变体

| 工作流 | 生产 Agent | 检查 Agent | 说明 |
|----------|---------------|---------------|-------|
| plan-phase | gsd-planner | gsd-plan-checker | 修订提示通过 planner-revision.md |
| execute-phase | gsd-executor | gsd-verifier | 执行后验证 |
| discuss-phase | 协调器 | gsd-plan-checker | 协调器内联修订 |

---

## 重要说明

- **INFO 级别问题始终可接受** —— 它们不触发修订
- **每次迭代都生成全新的 agent** —— 不要尝试在同一上下文中继续
- **必须内联检查器反馈** —— 修订 agent 需要确切看到什么失败了
- **不要静默吞噬问题** —— 退出循环后始终向用户展示最终状态
