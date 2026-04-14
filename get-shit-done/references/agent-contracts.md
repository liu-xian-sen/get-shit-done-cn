# Agent 契约

所有 GSD agent 的完成标记和交接 schema。工作流使用这些标记来检测 agent 完成情况并进行相应路由。

本文档描述的是**现状**，而非期望状态。大小写不一致问题已按照 agent 源文件中的实际情况记录。

---

## Agent 注册表

| Agent | 角色 | 完成标记 |
|-------|------|--------------------|
| gsd-planner | 创建计划 | `## PLANNING COMPLETE` |
| gsd-executor | 执行计划 | `## PLAN COMPLETE`、`## CHECKPOINT REACHED` |
| gsd-phase-researcher | 阶段范围内的研究 | `## RESEARCH COMPLETE`、`## RESEARCH BLOCKED` |
| gsd-project-researcher | 项目级别的研究 | `## RESEARCH COMPLETE`、`## RESEARCH BLOCKED` |
| gsd-plan-checker | 计划验证 | `## VERIFICATION PASSED`、`## ISSUES FOUND` |
| gsd-research-synthesizer | 多研究综合 | `## SYNTHESIS COMPLETE`、`## SYNTHESIS BLOCKED` |
| gsd-debugger | 调试调查 | `## DEBUG COMPLETE`、`## ROOT CAUSE FOUND`、`## CHECKPOINT REACHED` |
| gsd-roadmapper | 路线图创建/修订 | `## ROADMAP CREATED`、`## ROADMAP REVISED`、`## ROADMAP BLOCKED` |
| gsd-ui-auditor | UI 审查 | `## UI REVIEW COMPLETE` |
| gsd-ui-checker | UI 验证 | `## ISSUES FOUND` |
| gsd-ui-researcher | UI 规格创建 | `## UI-SPEC COMPLETE`、`## UI-SPEC BLOCKED` |
| gsd-verifier | 执行后验证 | `## Verification Complete`（首字母大写） |
| gsd-integration-checker | 跨阶段集成检查 | `## Integration Check Complete`（首字母大写） |
| gsd-nyquist-auditor | 抽样审计 | `## PARTIAL`、`## ESCALATE`（非标准） |
| gsd-security-auditor | 安全审计 | `## OPEN_THREATS`、`## ESCALATE`（非标准） |
| gsd-codebase-mapper | 代码库分析 | 无标记（直接写入文档） |
| gsd-assumptions-analyzer | 假设提取 | 无标记（返回 `## Assumptions` 章节） |
| gsd-doc-verifier | 文档验证 | 无标记（将 JSON 写入 `.planning/tmp/`） |
| gsd-doc-writer | 文档生成 | 无标记（直接写入文档） |
| gsd-advisor-researcher | 建议研究 | 无标记（实用工具 agent） |
| gsd-user-profiler | 用户画像 | 无标记（在分析标签中返回 JSON） |
| gsd-intel-updater | 代码库情报分析 | `## INTEL UPDATE COMPLETE`、`## INTEL UPDATE FAILED` |

## 标记规则

1. **全大写标记**（如 `## PLANNING COMPLETE`）是标准约定
2. **首字母大写标记**（如 `## Verification Complete`）存在于 gsd-verifier 和 gsd-integration-checker 中——这是有意为之的，不是 bug
3. **非标准标记**（如 `## PARTIAL`、`## ESCALATE`）在审计 agent 中表示需要协调器判断的部分结果
4. **无标记的 agent** 要么直接将制品写入磁盘，要么返回调用方解析的结构化数据（JSON/章节）
5. 标记必须作为 H2 标题（`## `）出现在 agent 最终输出的行首

## 关键交接契约

### Planner -> Executor（通过 PLAN.md）

| 字段 | 是否必须 | 描述 |
|-------|----------|-------------|
| Frontmatter | 是 | phase、plan、type、wave、depends_on、files_modified、autonomous、requirements |
| `<objective>` | 是 | 计划实现的目标 |
| `<tasks>` | 是 | 包含 type、files、action、verify、acceptance_criteria 的有序任务列表 |
| `<verification>` | 是 | 整体验证步骤 |
| `<success_criteria>` | 是 | 可衡量的完成标准 |

### Executor -> Verifier（通过 SUMMARY.md）

| 字段 | 是否必须 | 描述 |
|-------|----------|-------------|
| Frontmatter | 是 | phase、plan、subsystem、tags、key-files、metrics |
| 提交表格 | 是 | 每个任务的提交哈希和描述 |
| 偏差章节 | 是 | 自动修复的问题，或"无" |
| 自检 | 是 | PASSED 或 FAILED 并附详情 |

## 工作流正则模式

工作流匹配这些标记以检测 agent 完成情况：

**plan-phase.md 匹配：**
- `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED`（researcher 输出）
- `## PLANNING COMPLETE`（planner 输出）
- `## CHECKPOINT REACHED`（planner/executor 暂停）
- `## VERIFICATION PASSED` / `## ISSUES FOUND`（plan-checker 输出）

**execute-phase.md 匹配：**
- `## PHASE COMPLETE`（阶段中所有计划完成）
- `## Self-Check: FAILED`（summary 自检）

> **注意：** `## PLAN COMPLETE` 是 gsd-executor 的完成标记，但 execute-phase.md 不用正则匹配它。相反，它通过抽检（SUMMARY.md 是否存在、git 提交状态）来检测执行器完成情况。这是有意为之的行为，不是不匹配。
