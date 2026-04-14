# GSD 制品类型

本参考文档记录了 GSD 规划分类体系中的所有制品类型。每种类型都有明确的
形状、生命周期、位置和消费机制。格式正确但没有工作流读取的制品是无效的——
消费机制才赋予制品意义。

---

## 核心制品

### ROADMAP.md
- **形状**：里程碑 + 阶段列表，包含目标和规范引用
- **生命周期**：创建 → 每个里程碑更新 → 归档
- **位置**：`.planning/ROADMAP.md`
- **被消费**：`plan-phase`、`discuss-phase`、`execute-phase`、`progress`、`state` 命令

### STATE.md
- **形状**：当前位置追踪器（阶段、计划、进度、决策）
- **生命周期**：在整个项目中持续更新
- **位置**：`.planning/STATE.md`
- **被消费**：所有编排工作流；`resume-project`、`progress`、`next` 命令

### REQUIREMENTS.md
- **形状**：带可追溯性表格的编号验收标准
- **生命周期**：在项目开始时创建 → 随需求满足而更新
- **位置**：`.planning/REQUIREMENTS.md`
- **被消费**：`discuss-phase`、`plan-phase`、CONTEXT.md 生成；executor 标记完成

### CONTEXT.md（每阶段）
- **形状**：6 节格式：domain、decisions、canonical_refs、code_context、specifics、deferred
- **生命周期**：在规划前创建 → 在规划和执行期间使用 → 被下一阶段取代
- **位置**：`.planning/phases/XX-name/XX-CONTEXT.md`
- **被消费**：`plan-phase`（读取 decisions）、`execute-phase`（读取 code_context 和 canonical_refs）

### PLAN.md（每计划）
- **形状**：Frontmatter + 目标 + 包含类型的任务 + 成功标准 + 输出规格
- **生命周期**：由 planner 创建 → 执行 → 生成 SUMMARY.md
- **位置**：`.planning/phases/XX-name/XX-YY-PLAN.md`
- **被消费**：`execute-phase` executor；任务提交引用计划 ID

### SUMMARY.md（每计划）
- **形状**：带依赖图的 Frontmatter + 叙述 + 偏差 + 自检
- **生命周期**：在计划完成时创建 → 被同阶段后续计划读取
- **位置**：`.planning/phases/XX-name/XX-YY-SUMMARY.md`
- **被消费**：协调器（progress）、planner（未来计划的上下文）、`milestone-summary`

### HANDOFF.json / .continue-here.md
- **形状**：结构化暂停状态（JSON 机器可读 + Markdown 人类可读）
- **生命周期**：暂停时创建 → 恢复时消费 → 被下次暂停替换
- **位置**：`.planning/HANDOFF.json` + `.planning/phases/XX-name/.continue-here.md`（或 spike/deliberation 路径）
- **被消费**：`resume-project` 工作流

---

## 扩展制品

### DISCUSSION-LOG.md（每阶段）
- **形状**：discuss-phase 中假设和修正的审计追踪
- **生命周期**：在讨论时创建 → 只读审计记录
- **位置**：`.planning/phases/XX-name/XX-DISCUSSION-LOG.md`
- **被消费**：人工审查；不被自动化工作流读取

### USER-PROFILE.md
- **形状**：校准层级和偏好档案
- **生命周期**：由 `profile-user` 创建 → 随偏好观察更新
- **位置**：`~/.claude/get-shit-done/USER-PROFILE.md`
- **被消费**：`discuss-phase-assumptions`（校准层级）、`plan-phase`

### SPIKE.md / DESIGN.md（每 spike）
- **形状**：研究问题 + 方法论 + 发现 + 建议
- **生命周期**：创建 → 调查 → 决策 → 归档
- **位置**：`.planning/spikes/SPIKE-NNN/`
- **被消费**：引用 spike 时的 planner；spike 上下文交接的 `pause-work`

---

## 常驻参考制品

### METHODOLOGY.md

- **形状**：常驻参考 —— 跨阶段适用的可复用解释框架（视角）
- **生命周期**：创建 → 活跃 → 被取代（当某个视角被更好的取代时）
- **位置**：`.planning/METHODOLOGY.md`（项目范围，不是阶段范围）
- **内容**：命名视角，每个视角记录：
  - 诊断内容（它检测的问题类别）
  - 推荐内容（它规定的响应类别）
  - 适用时机（触发条件）
  - 示例：贝叶斯更新、STRIDE 威胁建模、延迟成本优先级
- **被消费**：
  - `discuss-phase-assumptions` —— 读取 METHODOLOGY.md（如果存在）并将活跃视角应用
    于当前假设分析，然后向用户展示发现
  - `plan-phase` —— 读取 METHODOLOGY.md，为每个计划告知方法论选择
  - `pause-work` —— 将 METHODOLOGY.md 包含在 `.continue-here.md` 的必读章节中，
    以便恢复的 agent 继承项目的分析取向

**为何消费很重要：** 没有工作流读取的 METHODOLOGY.md 是无效的。视角只有在
agent 在分析前将其加载到推理上下文中时才会生效。这就是为什么
discuss-phase-assumptions 和 pause-work 工作流都明确引用此文件。

**示例视角条目：**

```markdown
## 贝叶斯更新

**诊断：** 以过时先验做出的决策——早期形成的假设，自那以后证据已经
矛盾，但仍嵌入在计划中。

**推荐：** 在确认假设之前，问："什么证据会让我改变这个想法？"
如果没有任何证据能改变它，那它是信念，不是假设。标记供用户审查。

**适用时机：** 任何假设带有"有把握"标签，但在最近的架构
变更、库升级或范围修正之前形成。
```
