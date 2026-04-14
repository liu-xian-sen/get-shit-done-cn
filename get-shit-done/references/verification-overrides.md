# 验证覆盖

有意接受 must-have 失败的机制，适用于偏差已知且可接受的情况。防止对永远无法按原始规格通过的项目产生验证循环。

<override_format>

## 覆盖格式

覆盖在 VERIFICATION.md frontmatter 中的 `overrides:` 键下声明：

```yaml
---
phase: 03-authentication
verified: 2026-04-05T12:00:00Z
status: passed
score: 5/5
overrides_applied: 2
overrides:
  - must_have: "OAuth2 PKCE flow implemented"
    reason: "Using session-based auth instead — PKCE unnecessary for server-rendered app"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
  - must_have: "Rate limiting on login endpoint"
    reason: "Deferred to Phase 5 (infrastructure) — tracked in ROADMAP.md"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
---
```

### 必填字段

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `must_have` | string | 被覆盖的 must-have 事实、制品描述或关键链接。不需要完全匹配——适用模糊匹配。 |
| `reason` | string | 为什么这个偏差是可接受的。必须具体——不只是"不需要"。 |
| `accepted_by` | string | 谁接受了覆盖（用户名或角色）。必填。 |
| `accepted_at` | string | 覆盖被接受时的 ISO 时间戳。必填。 |

</override_format>

## 何时使用

当阶段在执行过程中有意偏离了原始计划时适用覆盖——例如需求被缩减范围、选择了替代方法或依赖关系发生了变化。

没有覆盖，验证器会将这些报告为 FAIL，即使偏差是有意的。覆盖让开发者可以将特定项目标记为 `PASSED (override)`，并附上记录的原因。

以下情况适合使用覆盖：
- 需求在规划后发生变化，但 ROADMAP.md 尚未更新
- 替代实现满足了意图，但不满足字面措辞
- must-have 被推迟到后续阶段且有明确追踪
- 外部约束使原始 must-have 不可能或不必要

## 何时不使用

以下情况**不适合**使用覆盖：
- 实现只是不完整——修复它
- must-have 不清楚——澄清它
- 开发者想跳过验证——那会破坏流程
- 同一阶段的多个 must-have 都在失败——如果超过 2-3 个项目需要覆盖，重新审视计划而不是批量覆盖

<matching_rules>

## 匹配规则

覆盖匹配使用**模糊匹配**，而非精确字符串比较。这能适应 ROADMAP.md、PLAN.md frontmatter 和覆盖条目中 must-have 措辞的细微差异。

### 匹配算法

1. **规范化两个字符串：** 大小写不敏感比较——两个字符串都转为小写，去掉标点，合并空白
2. **token 重叠：** 分词，计算交集
3. **匹配阈值：** 在**任一**方向上 80% token 重叠（覆盖 token 在 must-have 中找到，或 must-have token 在覆盖中找到）
4. **关键名词优先：** 名词和技术术语（文件路径、组件名、API 端点）比普通词权重更高

### 示例

| Must-Have | 覆盖 `must_have` | 匹配？ | 原因 |
|-----------|---------------------|--------|--------|
| "User can authenticate via OAuth2 PKCE" | "OAuth2 PKCE flow implemented" | 是 | 关键词 `OAuth2` 和 `PKCE` 重叠，满足 80% 阈值 |
| "Rate limiting on /api/auth/login" | "Rate limiting on login endpoint" | 是 | `rate limiting` + `login` 重叠 |
| "Chat component renders messages" | "OAuth2 PKCE flow implemented" | 否 | 没有有意义的 token 重叠 |
| "src/components/Chat.tsx provides message list" | "Chat.tsx message list rendering" | 是 | `Chat.tsx` + `message` + `list` 重叠 |

### 歧义解决

如果一个覆盖匹配多个 must-have，将其应用于**最具体的匹配**（最高 token 重叠百分比）。如果仍然有歧义，应用于第一个匹配并记录警告。

</matching_rules>

<verifier_behavior>

## 有覆盖时的验证器行为

### 检查顺序

覆盖检查发生在**将 must-have 标记为 FAIL 之前**。流程是：

1. 对照代码库评估 must-have（验证流程的步骤 3-5）
2. 如果评估结果为 FAIL 或 UNCERTAIN：
   a. 在 VERIFICATION.md frontmatter 的 `overrides:` 数组中查找模糊匹配
   b. 如果找到覆盖：标记为 `PASSED (override)` 而不是 FAIL
   c. 如果未找到覆盖：正常标记为 FAIL
3. 如果评估结果为 PASS：标记为 VERIFIED（覆盖不相关）

### 输出格式

在所有验证表格中，被覆盖的项目以明显不同的状态显示：

```markdown
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can authenticate | VERIFIED | OAuth session flow working |
| 2 | OAuth2 PKCE flow | PASSED (override) | Override: Using session-based auth — accepted by dave on 2026-04-04 |
| 3 | Chat renders messages | FAILED | Component returns placeholder |
```

`PASSED (override)` 状态在视觉上必须与 `VERIFIED` 和 `FAILED` 都明显不同。在证据列中，包括覆盖原因以及谁接受了它。

### 对整体状态的影响

- `PASSED (override)` 项目计入通过分数，而非失败分数
- 所有项目为 VERIFIED 或 PASSED (override) 的阶段可以有状态 `passed`
- 覆盖**不**抑制 `human_needed` 项目——这些仍然需要人工测试

### Frontmatter 分数

frontmatter 中的分数和覆盖数量反映已应用的覆盖：

```yaml
score: 5/5  # 包含 2 个覆盖
overrides_applied: 2
```

</verifier_behavior>

<creating_overrides>

## 创建覆盖

### 交互式覆盖建议

当验证器将 must-have 标记为 FAIL，且失败看起来是有意的（例如，存在替代实现，或代码明确以不同方式处理该情况）时，验证器应建议创建覆盖：

```markdown
### F-002: OAuth2 PKCE flow

**状态：** 失败
**证据：** 未找到 PKCE 实现。改为使用基于会话的认证。

**这看起来是有意的。** 代码库使用基于会话的认证，以不同方式实现了相同目标。要接受此偏差，请在 VERIFICATION.md frontmatter 中添加覆盖：

```yaml
overrides:
  - must_have: "OAuth2 PKCE flow implemented"
    reason: "Using session-based auth instead — PKCE unnecessary for server-rendered app"
    accepted_by: "{your name}"
    accepted_at: "{current ISO timestamp}"
```

然后重新运行验证以应用。
```

### 通过 gsd-tools 管理覆盖

覆盖也可以通过验证工作流管理：

1. 运行 `/gsd-verify-work` —— 验证发现差距
2. 审查差距 —— 确定哪些是有意的偏差
3. 在 VERIFICATION.md frontmatter 中添加覆盖条目
4. 重新运行 `/gsd-verify-work` —— 应用覆盖，显示剩余差距

</creating_overrides>

<override_lifecycle>

## 覆盖生命周期

### 重新验证期间

当阶段被重新验证（例如，差距闭合后）：
- 现有覆盖自动延续
- 如果底层代码现在满足 must-have，覆盖变得不必要——标记为 VERIFIED
- 覆盖不会自动删除；它们作为文档保留

### 里程碑完成时

在 `/gsd-audit-milestone` 期间，覆盖会在审计报告中浮现：

```
### 验证覆盖（{count} 个跨 {phase_count} 个阶段）

| 阶段 | Must-Have | 原因 | 接受人 |
|-------|----------|--------|-------------|
| 03 | OAuth2 PKCE | 改用基于会话的认证 | dave |
```

这让团队在关闭里程碑前能看到所有已接受的偏差。

### 清理

过时的覆盖（其中 must-have 后来被实现或从 ROADMAP.md 中删除）可以在里程碑完成期间清理。它们是信息性的——保留它们不会造成任何危害。

</override_lifecycle>

## VERIFICATION.md 示例

```markdown
---
phase: 03-api-layer
verified: 2026-04-05T12:00:00Z
status: passed
score: 3/3
overrides_applied: 1
overrides:
  - must_have: "paginated API responses"
    reason: "Descoped — dataset under 100 items, pagination adds complexity without value"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
---

## Phase 3: API Layer — Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | REST endpoints return JSON | VERIFIED | curl tests confirm |
| 2 | Paginated API responses | PASSED (override) | Descoped — see override: dataset under 100 items |
| 3 | Authentication middleware | VERIFIED | JWT validation working |
```
