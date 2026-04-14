# 通用反模式

适用于**所有**工作流和 agent 的规则。各个工作流可能有额外的特定反模式。

---

## 上下文预算规则

1. **绝不**读取 agent 定义文件（`agents/*.md`）—— `subagent_type` 会自动加载它们。将 agent 定义读入协调器会浪费上下文，因为其内容会自动注入到子 agent 会话中。
2. **绝不**将大文件内联到子 agent 提示中 —— 告诉 agent 从磁盘读取文件。Agent 有自己的上下文窗口。
3. **读取深度随上下文窗口扩展** —— 检查 `.planning/config.json` 中的 `context_window_tokens`。小于 500000 时：只读取 frontmatter、状态字段或摘要。大于等于 500000（1M 模型）时：当内容需要用于内联决策时允许完整正文读取。完整表格见 `references/context-budget.md`。
4. **委托**繁重工作给子 agent —— 协调器负责路由，不构建、分析、研究、调查或验证。
5. **主动暂停警告**：如果你已经消耗了大量上下文（大文件读取、多个子 agent 结果），警告用户："上下文预算压力较大。请考虑检查点当前进度。"

## 文件读取规则

6. **SUMMARY.md 读取深度随上下文窗口扩展** —— 当 context_window_tokens < 500000 时：仅从前一阶段的 SUMMARY 读取 frontmatter。大于等于 500000 时：允许对直接依赖阶段进行完整正文读取。无论如何，传递依赖（2+ 阶段之前）始终只读 frontmatter。
7. **绝不**读取其他阶段的完整 PLAN.md 文件 —— 只读取当前阶段的计划。
8. **绝不**读取 `.planning/logs/` 文件 —— 只有 health 工作流读取这些。
9. **不要**在 frontmatter 足够时重新读取完整文件内容 —— frontmatter 包含 status、key_files、commits 和 provides 字段。例外：大于等于 500000 时，需要语义内容的情况下重新读取完整正文是可接受的。

## 子 Agent 规则

10. **绝不**使用非 GSD 的 agent 类型（`general-purpose`、`Explore`、`Plan`、`Bash`、`feature-dev` 等）—— **始终**使用 `subagent_type: "gsd-{agent}"`（例如 `gsd-phase-researcher`、`gsd-executor`、`gsd-planner`）。GSD agent 拥有项目感知提示、审计日志和工作流上下文。通用 agent 绕过了所有这些。
11. **不要**重新讨论已在 CONTEXT.md（或 PROJECT.md 的 ## Context 章节）中锁定的决策 —— 无条件尊重已锁定的决策。

## 提问反模式

参考：`references/questioning.md` 了解完整的反模式列表。

12. **不要**逐一过清单 —— 清单式提问（从列表中逐条询问）是第一反模式。应使用渐进深度：先宽泛，在有趣的地方深入。
13. **不要**使用企业套话 —— 避免"利益相关者对齐"、"协同增效"、"可交付成果"等术语。使用简洁语言。
14. **不要**过早应用约束 —— 在理解问题之前不要缩小解决空间。先问问题，再设约束。

## 状态管理反模式

15. **不要直接用 Write/Edit 对 STATE.md 或 ROADMAP.md 进行变更。** 对于变更，始终使用 `gsd-tools.cjs` CLI 命令（`state update`、`state advance-plan`、`roadmap update-status`）。直接使用 Write 工具绕过了安全更新逻辑，在多会话环境中是不安全的。例外：首次从模板创建 STATE.md 是允许的。

## 行为规则

16. **不要**创建用户未批准的制品 —— 在写入新的规划文档之前始终确认。
17. **不要**修改工作流规定范围之外的文件 —— 检查计划的 files_modified 列表。
18. **不要**在没有明确优先级的情况下建议多个后续操作 —— 一个主要建议，备选项作为次要选项列出。
19. **不要**使用 `git add .` 或 `git add -A` —— 只暂存特定文件。
20. **不要**在规划文档或提交中包含敏感信息（API 密钥、密码、token）。

## 错误恢复规则

21. **Git 锁定检测**：在任何 git 操作之前，如果因"Unable to create lock file"失败，检查是否有陈旧的 `.git/index.lock` 并建议用户删除它（不要自动删除）。
22. **配置回退意识**：Config 加载在无效 JSON 时静默返回 `null`。如果你的工作流依赖 config 值，检查 null 并警告用户："config.json 无效或缺失——使用默认值运行。"
23. **部分状态恢复**：如果 STATE.md 引用了不存在的阶段目录，不要静默继续。警告用户并建议诊断不匹配。

## GSD 特定规则

24. **不要**检查 `mode === 'auto'` 或 `mode === 'autonomous'` —— GSD 使用 `yolo` 配置标志。检查 `yolo: true` 表示自主模式，缺失或 `false` 表示交互模式。
25. **始终使用 `gsd-tools.cjs`**（不是 `gsd-tools.js` 或任何其他变体）—— GSD 使用 CommonJS 保证 Node.js CLI 兼容性。
26. **计划文件必须遵循 `{padded_phase}-{NN}-PLAN.md` 模式**（例如 `01-01-PLAN.md`）。绝不使用 `PLAN-01.md`、`plan-01.md` 或任何其他变体——gsd-tools 检测依赖于这个确切模式。
27. **不要在为当前计划写 SUMMARY.md 之前开始执行下一个计划** —— 下游计划可能通过 `@` 引用它。

## iOS / Apple 平台规则

28. **绝不**将 `Package.swift` + `.executableTarget`（或 `.target`）作为 iOS 应用的主构建系统。SPM 可执行目标生成 macOS CLI 二进制文件，而非 iOS `.app` 包。它们不能安装在 iOS 设备上或提交到 App Store。使用 XcodeGen（`project.yml` + `xcodegen generate`）创建正确的 `.xcodeproj`。完整模式见 `references/ios-scaffold.md`。
29. **使用前验证 SwiftUI API 可用性。** 许多 SwiftUI API 需要特定的最低 iOS 版本（例如 `NavigationSplitView` 要求 iOS 16+，`List(selection:)` 多选和 `@Observable` 要求 iOS 17）。如果计划使用超出声明 `IPHONEOS_DEPLOYMENT_TARGET` 的 API，提升部署目标或添加 `#available` 守卫。
