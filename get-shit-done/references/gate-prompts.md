# 门禁提示模式

供工作流和 agent 中结构化门禁检查使用的可复用提示模式。

**关于检查点框格式的详细说明，参见 `references/ui-brand.md`** —— 检查点框使用双线边框绘制，内部宽度 62 个字符。

## 规则

- `header` 最多 12 个字符
- 门禁检查中 `multiSelect` 始终为 `false`
- 始终处理"其他"情况（用户输入了自由文本而非选择选项）
- 每个提示最多 4 个选项——如需更多，使用两步流程

---

## 模式：approve-revise-abort
用于计划审批、差距闭合审批的 3 选项门禁。
- question: "批准这些 {noun} 吗？"
- header: "Approve?"
- options: Approve | Request changes | Abort

## 模式：yes-no
用于重新规划、重建、替换计划、提交的简单 2 选项确认。
- question: "{关于该操作的具体问题}"
- header: "Confirm"
- options: Yes | No

## 模式：stale-continue
用于过时警告、时间戳新鲜度的 2 选项刷新门禁。
- question: "{制品}可能已过时。刷新还是继续？"
- header: "Stale"
- options: Refresh | Continue anyway

## 模式：yes-no-pick
用于种子选择、项目包含的 3 选项选择。
- question: "将 {items} 包含在规划中吗？"
- header: "Include?"
- options: Yes, all | Let me pick | No

## 模式：multi-option-failure
用于构建失败的 4 选项失败处理器。
- question: "计划 {id} 失败了。如何继续？"
- header: "Failed"
- options: Retry | Skip | Rollback | Abort

## 模式：multi-option-escalation
用于审查升级（超过最大重试次数）的 4 选项升级。
- question: "Phase {N} 已验证失败 {attempt} 次。如何继续？"
- header: "Escalate"
- options: Accept gaps | Re-plan (via /gsd-plan-phase) | Debug (via /gsd-debug) | Retry

## 模式：multi-option-gaps
用于审查找到差距的 4 选项差距处理器。
- question: "{count} 个验证差距需要处理。如何继续？"
- header: "Gaps"
- options: Auto-fix | Override | Manual | Skip

## 模式：multi-option-priority
用于里程碑差距优先级的 4 选项优先级选择。
- question: "应处理哪些差距？"
- header: "Priority"
- options: Must-fix only | Must + should | Everything | Let me pick

## 模式：toggle-confirm
用于启用/禁用布尔功能的 2 选项确认。
- question: "启用 {feature_name} 吗？"
- header: "Toggle"
- options: Enable | Disable

## 模式：action-routing
最多 4 个建议的下一步操作可供选择（状态、恢复工作流）。
- question: "接下来您想做什么？"
- header: "Next Step"
- options: {主要操作} | {备选 1} | {备选 2} | Something else
- 注意：从工作流状态动态生成选项。始终将"Something else"作为最后一个选项。

## 模式：scope-confirm
用于快速任务范围验证的 3 选项确认。
- question: "此任务看起来比较复杂。作为快速任务继续还是使用完整规划？"
- header: "Scope"
- options: Quick task | Full plan (via /gsd-plan-phase) | Revise

## 模式：depth-select
用于规划工作流偏好的 3 选项深度选择。
- question: "规划应该有多彻底？"
- header: "Depth"
- options: Quick (3-5 phases, skip research) | Standard (5-8 phases, default) | Comprehensive (8-12 phases, deep research)

## 模式：context-handling
用于 discuss 工作流中已存在 CONTEXT.md 的 3 选项处理器。
- question: "Phase {N} 已有 CONTEXT.md。如何处理？"
- header: "Context"
- options: Overwrite | Append | Cancel

## 模式：gray-area-option
用于 discuss 工作流中展示灰色地带选择的动态模板。
- question: "{灰色地带标题}"
- header: "Decision"
- options: {选项 1} | {选项 2} | Let Claude decide
- 注意：运行时生成选项。始终将"Let Claude decide"作为最后一个选项。
