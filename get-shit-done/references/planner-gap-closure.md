# 差距闭合模式 —— Planner 参考

由 `--gaps` 标志触发。创建计划以解决验证或 UAT 失败。

**重要：跳过已推迟的项目。** 读取 VERIFICATION.md 时，只有 `gaps:` 章节包含需要闭合计划的可操作项目。`deferred:` 章节（如果存在）列出了在后续里程碑阶段中明确处理的项目——这些**不是**差距，在差距闭合规划期间必须忽略。为已推迟的项目创建计划是在浪费精力处理已计划在未来阶段完成的工作。

**1. 查找差距来源：**

使用初始化上下文（来自 load_project_state）提供 `phase_dir`：

```bash
# 检查 VERIFICATION.md（代码验证差距）
ls "$phase_dir"/*-VERIFICATION.md 2>/dev/null

# 检查带有已诊断状态的 UAT.md（用户测试差距）
grep -l "status: diagnosed" "$phase_dir"/*-UAT.md 2>/dev/null
```

**2. 解析差距：** 每个差距包含：truth（失败的行为）、reason（原因）、artifacts（有问题的文件）、missing（需要添加/修复的内容）。

**3. 加载现有 SUMMARY** 以了解已构建的内容。

**4. 找到下一个计划编号：** 如果计划 01-03 已存在，下一个是 04。

**5. 将差距分组到计划中**，依据：相同制品、相同关注点、依赖顺序（如果制品是存根则无法接线 → 先修复存根）。

**6. 创建差距闭合任务：**

```xml
<task name="{修复描述}" type="auto">
  <files>{artifact.path}</files>
  <action>
    {对于 gap.missing 中的每个项目：}
    - {缺少的项目}

    参考现有代码：{来自 SUMMARY 的内容}
    差距原因：{gap.reason}
  </action>
  <verify>{如何确认差距已闭合}</verify>
  <done>{现在可实现的可观测事实}</done>
</task>
```

**7. 使用标准依赖分析分配波次**（与 `assign_waves` 步骤相同）：
- 没有依赖的计划 → 第 1 波
- 依赖其他差距闭合计划的计划 → max(依赖波次) + 1
- 同时考虑对阶段中现有（非差距）计划的依赖

**8. 写入 PLAN.md 文件：**

```yaml
---
phase: XX-name
plan: NN              # 在现有计划之后顺序递增
type: execute
wave: N               # 从 depends_on 计算（参见 assign_waves）
depends_on: [...]     # 此计划依赖的其他计划（差距或现有）
files_modified: [...]
autonomous: true
gap_closure: true     # 用于追踪的标志
---
```
