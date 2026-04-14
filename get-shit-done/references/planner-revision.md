# 修订模式 —— Planner 参考

当协调器提供包含检查器问题的 `<revision_context>` 时触发。**不是**从头开始——而是对现有计划进行针对性更新。

**思维方式：** 外科医生，而非架构师。针对具体问题做最小改动。

### 步骤 1：加载现有计划

```bash
cat .planning/phases/$PHASE-*/$PHASE-*-PLAN.md
```

建立对当前计划结构、现有任务、must_haves 的心理模型。

### 步骤 2：解析检查器问题

问题以结构化格式提供：

```yaml
issues:
  - plan: "16-01"
    dimension: "task_completeness"
    severity: "blocker"
    description: "任务 2 缺少 <verify> 元素"
    fix_hint: "为构建输出添加验证命令"
```

按计划、维度、严重性分组。

### 步骤 3：修订策略

| 维度 | 策略 |
|-----------|----------|
| requirement_coverage | 为缺失的需求添加任务 |
| task_completeness | 为现有任务添加缺失元素 |
| dependency_correctness | 修复 depends_on，重新计算波次 |
| key_links_planned | 添加接线任务或更新动作 |
| scope_sanity | 拆分为多个计划 |
| must_haves_derivation | 推导并将 must_haves 添加到 frontmatter |

### 步骤 4：进行针对性更新

**应该：** 编辑特定标记的章节，保留正常工作的部分，依赖关系变更时更新波次。

**不应该：** 为小问题重写整个计划，添加不必要的任务，破坏现有正常工作的计划。

### 步骤 5：验证变更

- [ ] 所有标记的问题已处理
- [ ] 没有引入新问题
- [ ] 波次编号仍然有效
- [ ] 依赖关系仍然正确
- [ ] 磁盘上的文件已更新

### 步骤 6：提交

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "fix($PHASE): revise plans based on checker feedback" --files .planning/phases/$PHASE-*/$PHASE-*-PLAN.md
```

### 步骤 7：返回修订摘要

```markdown
## REVISION COMPLETE

**已处理的问题：** {N}/{M}

### 所做的变更

| 计划 | 变更 | 处理的问题 |
|------|--------|-----------------|
| 16-01 | 向任务 2 添加了 <verify> | task_completeness |
| 16-02 | 添加了退出登录任务 | requirement_coverage (AUTH-02) |

### 已更新的文件

- .planning/phases/16-xxx/16-01-PLAN.md
- .planning/phases/16-xxx/16-02-PLAN.md

{如果有问题未处理：}

### 未处理的问题

| 问题 | 原因 |
|-------|--------|
| {问题} | {原因 - 需要用户输入、架构变更等} |
```
